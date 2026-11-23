/**
 * Token reach ring, sense vision, and per-turn attacks of opportunity.
 */

import { visionFromSenses } from "../helpers/table-combat.mjs";
import { lightingPreset } from "../helpers/lighting.mjs";
import { actorForPersist } from "../utils/persist-actor.mjs";

function drawThreat(token) {
  let show = true;
  try {
    show = game.settings.get("CTS-DND-35", "showThreatRings") !== false;
  } catch {
    show = true;
  }
  const existing = token.children?.find?.((child) => child?.name === "cts-threat");
  if (!show) {
    existing?.destroy?.();
    return;
  }
  const reach = Number(token.actor?.system?.traits?.reachFt) || 0;
  if (!reach || typeof PIXI === "undefined") {
    existing?.destroy?.();
    return;
  }
  const graphic = existing || new PIXI.Graphics();
  if (!existing) {
    graphic.name = "cts-threat";
    token.addChild(graphic);
  }
  graphic.clear?.();
  const grid = canvas.grid?.size || 100;
  const feet = Number(canvas.scene?.grid?.distance) || 5;
  const wide = Math.max(1, Math.floor(Number(token.document?.width) || 1));
  const tall = Math.max(1, Math.floor(Number(token.document?.height) || wide));
  const squares = Math.max(1, Math.ceil(reach / feet));
  const paint = () => {
    for (let gx = -squares; gx < wide + squares; gx++) {
      for (let gy = -squares; gy < tall + squares; gy++) {
        if (gx >= 0 && gx < wide && gy >= 0 && gy < tall) continue;
        const dx = gx < 0 ? -gx : gx >= wide ? gx - wide + 1 : 0;
        const dy = gy < 0 ? -gy : gy >= tall ? gy - tall + 1 : 0;
        const diagonal = dx > 0 && dy > 0 ? Math.floor((dx + dy) / 2) : 0;
        const distance = (dx + dy - diagonal) * feet;
        if (distance <= 0 || distance > reach) continue;
        if (typeof graphic.drawRect === "function") graphic.drawRect(gx * grid, gy * grid, grid, grid);
        else if (typeof graphic.rect === "function") graphic.rect(gx * grid, gy * grid, grid, grid);
      }
    }
  };
  if (typeof graphic.lineStyle === "function") {
    graphic.lineStyle(2, 0xc45c26, 0.85);
    paint();
  } else if (typeof graphic.rect === "function") {
    paint();
    graphic.stroke?.({ width: 2, color: 0xc45c26, alpha: 0.85 });
  }
}

export function detectFlanking(actor) {
  try {
    const tokens = actor?.getActiveTokens?.() || [];
    const attacker = tokens[0];
    const target = [...(globalThis.game?.user?.targets || [])][0];
    if (!attacker || !target || attacker === target) return false;
    const center = (token) => ({ x: token.center?.x ?? token.x ?? 0, y: token.center?.y ?? token.y ?? 0 });
    const from = center(attacker);
    const at = center(target);
    const vx = from.x - at.x;
    const vy = from.y - at.y;
    const grid = canvas?.grid?.size || 100;
    const feet = Number(canvas?.scene?.grid?.distance) || 5;
    const reach = Number(actor.system?.traits?.reachFt) || 5;
    if (Math.hypot(vx, vy) > ((reach / feet) + (attacker.document?.width || 1)) * grid) return false;
    for (const other of canvas?.tokens?.placeables || []) {
      if (other === attacker || other === target) continue;
      if ((other.document?.disposition ?? 0) !== (attacker.document?.disposition ?? 0)) continue;
      const otherActor = other.actor;
      if (!otherActor) continue;
      const otherReach = Number(otherActor.system?.traits?.reachFt) || 5;
      const spot = center(other);
      const ox = spot.x - at.x;
      const oy = spot.y - at.y;
      if (Math.hypot(ox, oy) > ((otherReach / feet) + (other.document?.width || 1)) * grid) continue;
      if (vx * ox + vy * oy < 0) return true;
    }
  } catch (err) {
    console.warn("CTS DND 3.5 | Flanking check failed.", err);
  }
  return false;
}

function visionModeForScene(vision, scene) {
  const modes = globalThis.CONFIG?.Canvas?.visionModes || {};
  let mode = modes[vision.visionMode] ? vision.visionMode : "basic";
  const band = lightingPreset(scene?.getFlag?.("CTS-DND-35", "lighting"))?.band;
  if (band === "magical" && mode !== "blindsight") mode = "basic";
  return mode;
}

export async function applySensesToTokens(actor, scene = null) {
  if (!actor) return;
  const vision = visionFromSenses(actor.system?.traits?.senses || {});
  if (!vision.range && !vision.lowLight) return;
  const range = vision.range || 0;
  const home = scene || canvas?.scene;
  const visionMode = visionModeForScene(vision, home);
  const prototype = {
    "prototypeToken.sight.enabled": true,
    "prototypeToken.sight.visionMode": visionMode,
  };
  if (range) prototype["prototypeToken.sight.range"] = range;
  const sightActor = actorForPersist(actor);
  if (sightActor) {
    try {
      await sightActor.update(prototype);
    } catch (err) {
      console.warn("CTS DND 3.5 | Could not update prototype token sight.", err);
    }
  }
  const docs = new Set();
  for (const token of home?.tokens || []) {
    if (!token?.id || token.parent?.tokens?.get(token.id) !== token) continue;
    if (token.actor === actor || token.actor === sightActor || token.actorId === actor.id || token.actorId === sightActor?.id) docs.add(token);
  }
  for (const token of actor.getActiveTokens?.(false, true) || []) {
    if (token?.id && token.parent?.tokens?.get(token.id) === token) docs.add(token);
  }
  for (const token of docs) {
    const mode = visionModeForScene(vision, token.parent || home);
    const patch = { "sight.enabled": true, "sight.visionMode": mode };
    if (range) patch["sight.range"] = range;
    try {
      await token.update(patch);
    } catch (err) {
      console.warn("CTS DND 3.5 | Could not update token sight.", err);
    }
  }
}

function sensesChanged(changes) {
  if (changes?.system?.traits?.senses) return true;
  return Object.keys(changes || {}).some((key) => key.startsWith("system.traits.senses"));
}

export function registerTokenCombatHooks() {
  Hooks.on("refreshToken", (token) => {
    try {
      drawThreat(token);
    } catch (err) {
      console.warn("CTS DND 3.5 | Threat ring failed.", err);
    }
  });

  Hooks.on("updateActor", (actor, changes) => {
    if (!sensesChanged(changes)) return;
    applySensesToTokens(actor);
  });

  Hooks.on("updateCombat", async (combat, changed) => {
    if (changed.turn === undefined && changed.round === undefined) return;
    const actor = combat.combatant?.actor;
    if (!actor) return;
    const durations = foundry.utils.deepClone(actor.system?.details?.status?.durations || {});
    const conditions = foundry.utils.deepClone(actor.system?.details?.status?.conditions || {});
    for (const [key, rounds] of Object.entries(durations)) {
      const left = Math.max(0, Math.floor(Number(rounds) || 0) - 1);
      durations[key] = left;
      if (left <= 0) conditions[key] = false;
    }
    try {
      await actor.update({
        "system.attributes.combat.aooSpent": 0,
        "system.attributes.combat.standardLeft": true,
        "system.attributes.combat.moveLeft": true,
        "system.attributes.combat.swiftLeft": true,
        "system.attributes.combat.delayed": false,
        "system.attributes.combat.readied": false,
        "system.details.status.durations": durations,
        "system.details.status.conditions": conditions,
      });
    } catch (err) {
      console.warn("CTS DND 3.5 | Could not refresh the turn.", err);
    }
  });
}
