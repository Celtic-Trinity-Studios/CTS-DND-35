/**
 * Merchant shop rules for CTS DND 3.5 — mirrors Item Piles-style merchants using actor inventory + gp pricing.
 */

import { adjustedGearPrice } from "./trade-modifiers.mjs";

/** Item types that appear in merchant stock / sell-back lists (loot-grade gear). */
export const MERCHANT_ITEM_TYPES = new Set(["weapon", "armor", "equipment", "consumable"]);

/**
 * @param {Item} item
 */
export function isMerchantTradableItem(item) {
  return item && MERCHANT_ITEM_TYPES.has(item.type);
}

/**
 * Buyer purchases listed goods from NPC merchant (seller).
 */
export function computeBuyPriceGp(item, buyerActor, merchantActor, merchantSettings) {
  const base = Number(item?.system?.price) || 0;
  const mult = Math.max(0, Number(merchantSettings?.buyMultiplier) ?? 1);
  const adjustedBase = base * mult;
  return adjustedGearPrice(adjustedBase, buyerActor, merchantActor);
}

/**
 * Buyer sells goods to NPC merchant (merchant pays using trade modifiers).
 */
export function computeSellPriceGp(item, buyerActor, merchantActor, merchantSettings) {
  const base = Number(item?.system?.price) || 0;
  const mult = Math.max(0, Number(merchantSettings?.sellMultiplier) ?? 0.5);
  const adjustedBase = base * mult;
  return adjustedGearPrice(adjustedBase, merchantActor, buyerActor);
}

/**
 * @param {Actor} actor
 */
export function getMerchantSettings(actor) {
  const m = actor?.system?.merchant;
  if (!m) {
    return {
      enabled: false,
      purchaseOnly: false,
      buyMultiplier: 1,
      sellMultiplier: 0.5,
    };
  }
  return {
    enabled: m.enabled === true || m.enabled === "true",
    purchaseOnly: m.purchaseOnly === true || m.purchaseOnly === "true",
    buyMultiplier: Math.max(0, Number(m.buyMultiplier) || 1),
    sellMultiplier: Math.max(0, Number(m.sellMultiplier) || 0.5),
  };
}
