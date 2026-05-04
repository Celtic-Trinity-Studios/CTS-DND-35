/**
 * Socket bridge so players can run merchant trades when the GM owns the NPC.
 */

import { MerchantApp } from "../apps/merchant-app.mjs";
import { executeMerchantBuy, executeMerchantSell } from "../utils/merchant-transactions.mjs";

export function registerMerchantSockets() {
  game.socket.on("system.CTS-DND-35", async (data) => {
    if (!data) return;

    if (data.type === "merchantResponse" && data.targetUserId === game.user.id) {
      const resolve = MerchantApp._pending.get(data.requestId);
      if (resolve) {
        MerchantApp._pending.delete(data.requestId);
        resolve(data.result);
      }
      return;
    }

    if (!game.user.isGM) return;

    if (data.action === "merchantBuy") {
      const result = await executeMerchantBuy(
        data.merchantId,
        data.buyerId,
        data.itemId,
        data.quantity,
        data.userId,
      );
      game.socket.emit("system.CTS-DND-35", {
        type: "merchantResponse",
        requestId: data.requestId,
        result,
        targetUserId: data.userId,
      });
      return;
    }

    if (data.action === "merchantSell") {
      const result = await executeMerchantSell(
        data.merchantId,
        data.buyerId,
        data.itemId,
        data.quantity,
        data.userId,
      );
      game.socket.emit("system.CTS-DND-35", {
        type: "merchantResponse",
        requestId: data.requestId,
        result,
        targetUserId: data.userId,
      });
    }
  });
}
