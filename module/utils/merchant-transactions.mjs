/**
 * GM-side merchant buy/sell execution (used locally or from socket).
 */

import { addCpToActorCurrency, gpToCp, subtractCpFromActorCurrency } from "./currency.mjs";
import {
  computeBuyPriceGp,
  computeSellPriceGp,
  getMerchantSettings,
  isMerchantTradableItem,
} from "./merchant-trade.mjs";

/**
 * @param {User} user
 * @param {Actor} actor
 */
function userMayTradeFor(user, actor) {
  if (!user || !actor) return false;
  if (user.isGM) return true;
  return actor.testUserPermission(user, "OWNER");
}

function clampQty(n, min, max) {
  const q = Math.floor(Number(n) || 1);
  return Math.min(Math.max(q, min), max);
}

/**
 * @param {string} merchantId
 * @param {string} buyerId
 * @param {string} itemId
 * @param {number} quantity
 * @param {string} [requestingUserId]
 */
export async function executeMerchantBuy(merchantId, buyerId, itemId, quantity, requestingUserId) {
  const merchant = game.actors.get(merchantId);
  const buyer = game.actors.get(buyerId);
  const user = requestingUserId ? game.users.get(requestingUserId) : game.user;

  if (!merchant || merchant.type !== "npc" || !buyer) {
    return { ok: false, error: "CTSDND35.MerchantErrorInvalidActor" };
  }
  const settings = getMerchantSettings(merchant);
  if (!settings.enabled) return { ok: false, error: "CTSDND35.MerchantErrorNotEnabled" };
  if (!userMayTradeFor(user, buyer)) return { ok: false, error: "CTSDND35.MerchantErrorNoPermission" };

  const item = merchant.items.get(itemId);
  if (!item || !isMerchantTradableItem(item)) {
    return { ok: false, error: "CTSDND35.MerchantErrorBadItem" };
  }

  const maxQty = Math.max(1, Math.floor(Number(item.system?.quantity) || 1));
  const qty = clampQty(quantity, 1, maxQty);

  const unitPrice = computeBuyPriceGp(item, buyer, merchant, settings);
  const totalGp = unitPrice * qty;
  const totalCp = gpToCp(totalGp);
  if (totalCp <= 0) return { ok: false, error: "CTSDND35.MerchantErrorZeroPrice" };

  const newBuyerWallet = subtractCpFromActorCurrency(buyer, totalCp);
  if (newBuyerWallet === false) {
    return { ok: false, error: "CTSDND35.MerchantErrorCannotAfford" };
  }

  const newMerchantWallet = addCpToActorCurrency(merchant, totalCp);

  const itemData = item.toObject();
  itemData.system = foundry.utils.deepClone(itemData.system ?? {});
  itemData.system.quantity = qty;
  delete itemData._id;
  if (itemData.effects) itemData.effects = [];

  const nextStock = maxQty - qty;

  try {
    await buyer.update({ "system.currency": newBuyerWallet });
    await merchant.update({ "system.currency": newMerchantWallet });
    if (nextStock <= 0) {
      await merchant.deleteEmbeddedDocuments("Item", [itemId]);
    } else {
      await item.update({ "system.quantity": nextStock });
    }
    await buyer.createEmbeddedDocuments("Item", [itemData]);
  } catch (err) {
    console.error("CTS DND 3.5 | Merchant buy failed", err);
    return { ok: false, error: "CTSDND35.MerchantErrorGeneric" };
  }

  return { ok: true, totalGp, qty };
}

/**
 * @param {string} merchantId
 * @param {string} buyerId
 * @param {string} itemId
 * @param {number} quantity
 * @param {string} [requestingUserId]
 */
export async function executeMerchantSell(merchantId, buyerId, itemId, quantity, requestingUserId) {
  const merchant = game.actors.get(merchantId);
  const buyer = game.actors.get(buyerId);
  const user = requestingUserId ? game.users.get(requestingUserId) : game.user;

  if (!merchant || merchant.type !== "npc" || !buyer) {
    return { ok: false, error: "CTSDND35.MerchantErrorInvalidActor" };
  }
  const settings = getMerchantSettings(merchant);
  if (!settings.enabled) return { ok: false, error: "CTSDND35.MerchantErrorNotEnabled" };
  if (settings.purchaseOnly) return { ok: false, error: "CTSDND35.MerchantErrorPurchaseOnly" };
  if (!userMayTradeFor(user, buyer)) return { ok: false, error: "CTSDND35.MerchantErrorNoPermission" };

  const item = buyer.items.get(itemId);
  if (!item || !isMerchantTradableItem(item)) {
    return { ok: false, error: "CTSDND35.MerchantErrorBadItem" };
  }

  const maxQty = Math.max(1, Math.floor(Number(item.system?.quantity) || 1));
  const qty = clampQty(quantity, 1, maxQty);

  const unitPrice = computeSellPriceGp(item, buyer, merchant, settings);
  const totalGp = unitPrice * qty;
  const totalCp = gpToCp(totalGp);

  let newBuyerWallet;
  let newMerchantWallet;
  if (totalCp > 0) {
    newMerchantWallet = subtractCpFromActorCurrency(merchant, totalCp);
    if (newMerchantWallet === false) {
      return { ok: false, error: "CTSDND35.MerchantErrorMerchantFunds" };
    }
    newBuyerWallet = addCpToActorCurrency(buyer, totalCp);
  } else {
    newBuyerWallet = foundry.utils.duplicate(buyer.system.currency);
    newMerchantWallet = foundry.utils.duplicate(merchant.system.currency);
  }

  const itemData = item.toObject();
  itemData.system = foundry.utils.deepClone(itemData.system ?? {});
  itemData.system.quantity = qty;
  delete itemData._id;
  if (itemData.effects) itemData.effects = [];

  try {
    await buyer.update({ "system.currency": newBuyerWallet });
    await merchant.update({ "system.currency": newMerchantWallet });

    const existing = merchant.items.find((i) => i.type === item.type && i.name === item.name);
    if (existing && existing.system && "quantity" in existing.system) {
      const n = Math.max(1, Math.floor(Number(existing.system.quantity) || 1));
      await existing.update({ "system.quantity": n + qty });
    } else {
      await merchant.createEmbeddedDocuments("Item", [itemData]);
    }

    const nextStock = maxQty - qty;
    if (nextStock <= 0) {
      await buyer.deleteEmbeddedDocuments("Item", [itemId]);
    } else {
      await item.update({ "system.quantity": nextStock });
    }
  } catch (err) {
    console.error("CTS DND 3.5 | Merchant sell failed", err);
    return { ok: false, error: "CTSDND35.MerchantErrorGeneric" };
  }

  return { ok: true, totalGp, qty };
}
