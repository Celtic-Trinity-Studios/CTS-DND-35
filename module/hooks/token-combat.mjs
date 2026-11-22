/**
 * Token reach ring, sense vision, and per-turn attacks of opportunity.
 */

import { visionFromSenses } from "../helpers/table-combat.mjs";
import { lightingPreset } from "../helpers/lighting.mjs";

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
  const tokenWidth = (Number(token.document?.width) || 1) * grid;
  const radius = tokenWidth / 2 + (reach / feet) * grid;
  const x = (token.w || tokenWidth) / 2;
  const y = (token.h || tokenWidth) / 2;
  if (typeof graphic.lineStyle === "function") {
    graphic.lineStyle(2, 0xc45c26, 0.85);
    graphic.drawCircle(x, y, radius);
  } else if (typeof graphic.circle === "function") {
    graphic.circle(x, y, radius).stroke({ width: 2, color: 0xc45c26, alpha: 0.85 });
  }
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
  try {
    await actor.update(prototype);
  } catch (err) {
    console.warn("CTS DND 3.5 | Could not update prototype token sight.", err);
  }
  const docs = new Set();
  for (const token of home?.tokens || []) {
    if (token.actor === actor || token.actorId === actor.id) docs.add(token);
  }
  for (const token of actor.getActiveTokens?.(false, true) || []) docs.add(token);
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
    const spent = Number(actor?.system?.attributes?.combat?.aooSpent) || 0;
    if (!actor || spent <= 0) return;
    try {
      await actor.update({ "system.attributes.combat.aooSpent": 0 });
    } catch (err) {
      console.warn("CTS DND 3.5 | Could not refresh attacks of opportunity.", err);
    }
  });
}
