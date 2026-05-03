/**
 * Con permanent increase → retroactive HP (PHB): +ΔCon modifier × character level to max & current HP.
 * Runs only on the client that submitted the actor update.
 */

const _pendingConValue = new Map();

export function registerActorCharacterMechanicsHooks() {
  Hooks.on("preUpdateActor", (actor, update) => {
    if (actor.type !== "character") return;
    const nextCon = foundry.utils.getProperty(update, "system.abilities.con.value");
    if (nextCon === undefined) return;
    _pendingConValue.set(actor.uuid, Number(actor.system?.abilities?.con?.value));
  });

  Hooks.on("updateActor", async (actor, changed, _opts, userId) => {
    if (actor.type !== "character") return;
    if (userId && userId !== game.user.id) return;

    const oldVal = _pendingConValue.get(actor.uuid);
    _pendingConValue.delete(actor.uuid);
    if (oldVal === undefined) return;

    const newVal = Number(actor.system?.abilities?.con?.value);
    if (!Number.isFinite(newVal) || newVal === oldVal) return;

    const oldMod = Math.floor((Number(oldVal) - 10) / 2);
    const newMod = Math.floor((newVal - 10) / 2);
    const delta = newMod - oldMod;
    const level = Math.max(0, Math.floor(Number(actor.system?.details?.level?.value) || 0));
    if (delta === 0 || level === 0) return;

    const hpDelta = delta * level;
    const hp = actor.system.attributes?.hp ?? {};
    const max = Math.max(0, Math.floor(Number(hp.max) || 0) + hpDelta);
    const value = Math.max(0, Math.floor(Number(hp.value) || 0) + hpDelta);

    try {
      await actor.update({ "system.attributes.hp.max": max, "system.attributes.hp.value": value });
    } catch (err) {
      console.warn("CTS DND 35 | Could not apply Con-based HP adjustment:", err);
    }
  });
}
