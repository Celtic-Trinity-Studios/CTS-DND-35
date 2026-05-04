/**
 * CTS DND 3.5 — Merchant shop UI (buy/sell vs NPC inventory + gp pricing).
 */

import { walletToCp } from "../utils/currency.mjs";
import {
  computeBuyPriceGp,
  computeSellPriceGp,
  getMerchantSettings,
  isMerchantTradableItem,
} from "../utils/merchant-trade.mjs";
import { executeMerchantBuy, executeMerchantSell } from "../utils/merchant-transactions.mjs";

export class MerchantApp extends Application {
  /** @type {Map<string, (r: object) => void>} */
  static _pending = new Map();

  /**
   * @param {Actor} merchant
   * @param {Actor} buyer
   * @param {object} [options]
   */
  constructor(merchant, buyer, options = {}) {
    const title = `${game.i18n.localize("CTSDND35.MerchantShop")}: ${merchant?.name ?? ""}`;
    super(
      foundry.utils.mergeObject(options, {
        id: `cts-merchant-${merchant?.id}-${buyer?.id}`,
        title,
      }),
    );
    this.merchant = merchant;
    this.buyer = buyer;
  }

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["cts-dnd-35", "merchant-app"],
      template: "systems/CTS-DND-35/templates/merchant-app.hbs",
      width: 580,
      height: 680,
      resizable: true,
    });
  }

  /**
   * @param {string|Actor} merchantRef
   * @param {string|Actor} buyerRef
   */
  static open(merchantRef, buyerRef) {
    const merchant = typeof merchantRef === "string" ? game.actors.get(merchantRef) : merchantRef;
    const buyer = typeof buyerRef === "string" ? game.actors.get(buyerRef) : buyerRef;
    const settings = getMerchantSettings(merchant);
    if (!merchant || merchant.type !== "npc" || !settings.enabled) {
      ui.notifications.warn(game.i18n.localize("CTSDND35.MerchantErrorNotEnabled"));
      return null;
    }
    if (!buyer) {
      ui.notifications.warn(game.i18n.localize("CTSDND35.MerchantErrorNoBuyer"));
      return null;
    }
    const app = new MerchantApp(merchant, buyer);
    app.render(true);
    return app;
  }

  /** @override */
  async getData(options = {}) {
    const context = await super.getData(options);
    const merchant = game.actors.get(this.merchant.id);
    const buyer = game.actors.get(this.buyer.id);
    if (!merchant || !buyer) {
      return foundry.utils.mergeObject(context, { invalid: true });
    }
    this.merchant = merchant;
    this.buyer = buyer;

    const settings = getMerchantSettings(merchant);
    const stock = [];
    for (const item of merchant.items) {
      if (!isMerchantTradableItem(item)) continue;
      stock.push({
        id: item.id,
        name: item.name,
        img: item.img || "icons/svg/item-bag.svg",
        type: item.type,
        qty: Math.max(1, Math.floor(Number(item.system?.quantity) || 1)),
        unitBuyGp: computeBuyPriceGp(item, buyer, merchant, settings),
      });
    }
    stock.sort((a, b) => a.name.localeCompare(b.name));

    const sellRows = [];
    if (!settings.purchaseOnly) {
      for (const item of buyer.items) {
        if (!isMerchantTradableItem(item)) continue;
        sellRows.push({
          id: item.id,
          name: item.name,
          img: item.img || "icons/svg/item-bag.svg",
          type: item.type,
          qty: Math.max(1, Math.floor(Number(item.system?.quantity) || 1)),
          unitSellGp: computeSellPriceGp(item, buyer, merchant, settings),
        });
      }
      sellRows.sort((a, b) => a.name.localeCompare(b.name));
    }

    const cur = buyer.system?.currency ?? {};
    const walletCp = walletToCp(cur);

    return foundry.utils.mergeObject(context, {
      invalid: false,
      merchantName: merchant.name,
      buyerName: buyer.name,
      purchaseOnly: settings.purchaseOnly,
      stock,
      sellRows,
      wallet: cur,
      walletCp,
      walletGpEquiv: (walletCp / 100).toFixed(2),
      merchantId: merchant.id,
      buyerId: buyer.id,
    });
  }

  /** @override */
  render(force = false, options = {}) {
    if (!this._hookBound) {
      this._onActorUpdate = (doc) => {
        if (doc.id === this.merchant?.id || doc.id === this.buyer?.id) {
          this.render(false);
        }
      };
      Hooks.on("updateActor", this._onActorUpdate);
      this._hookBound = true;
    }
    return super.render(force, options);
  }

  /** @override */
  close(options = {}) {
    if (this._hookBound) {
      Hooks.off("updateActor", this._onActorUpdate);
      this._hookBound = false;
    }
    return super.close(options);
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);
    html.on("click", "[data-merchant-buy]", this._onBuy.bind(this, html));
    html.on("click", "[data-merchant-sell]", this._onSell.bind(this, html));
  }

  /**
   * @param {jQuery} html
   */
  async _onBuy(html, ev) {
    ev.preventDefault();
    const itemId = ev.currentTarget?.dataset?.itemId;
    if (!itemId) return;
    const row = html.find(`input[data-buy-qty="${itemId}"]`);
    const qty = Math.max(1, Math.floor(Number(row.val()) || 1));
    const result = await this._requestTrade("merchantBuy", itemId, qty);
    this._notify(result);
    if (result?.ok) this.render(false);
  }

  /**
   * @param {jQuery} html
   */
  async _onSell(html, ev) {
    ev.preventDefault();
    const itemId = ev.currentTarget?.dataset?.itemId;
    if (!itemId) return;
    const row = html.find(`input[data-sell-qty="${itemId}"]`);
    const qty = Math.max(1, Math.floor(Number(row.val()) || 1));
    const result = await this._requestTrade("merchantSell", itemId, qty);
    this._notify(result);
    if (result?.ok) this.render(false);
  }

  _notify(result) {
    if (!result) return;
    if (result.ok) {
      ui.notifications.info(
        game.i18n.format("CTSDND35.MerchantTradeOk", { gp: Number(result.totalGp || 0).toFixed(2) }),
      );
    } else {
      const msg = game.i18n.localize(result.error || "CTSDND35.MerchantErrorGeneric");
      ui.notifications.warn(msg);
    }
  }

  /**
   * @param {"merchantBuy"|"merchantSell"} action
   */
  async _requestTrade(action, itemId, quantity) {
    const requestId = foundry.utils.randomID();
    const payload = {
      action,
      requestId,
      userId: game.user.id,
      merchantId: this.merchant.id,
      buyerId: this.buyer.id,
      itemId,
      quantity,
    };

    if (game.user.isGM) {
      if (action === "merchantBuy") {
        return executeMerchantBuy(payload.merchantId, payload.buyerId, payload.itemId, payload.quantity, payload.userId);
      }
      return executeMerchantSell(payload.merchantId, payload.buyerId, payload.itemId, payload.quantity, payload.userId);
    }

    return new Promise((resolve) => {
      MerchantApp._pending.set(requestId, resolve);
      game.socket.emit("system.CTS-DND-35", payload);
      window.setTimeout(() => {
        if (MerchantApp._pending.has(requestId)) {
          MerchantApp._pending.delete(requestId);
          resolve({ ok: false, error: "CTSDND35.MerchantErrorTimeout" });
        }
      }, 15000);
    });
  }
}
