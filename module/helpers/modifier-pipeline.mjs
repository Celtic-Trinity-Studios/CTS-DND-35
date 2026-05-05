/**
 * Modifier pipeline — resets fields that Active Effects (mode add/upgrade) mutate each preparation pass.
 *
 * Manual misc fields (sheet inputs) stay separate: save.bonus, skill.misc, init.bonus.
 */

import { CTSDND35 } from "./config.mjs";

/** Reference list for macro authors / AE authoring (mode Add unless noted). */
export const ACTIVE_EFFECT_ATTRIBUTE_KEYS = [
  "system.attributes.ac.bonuses.dodge",
  "system.attributes.ac.bonuses.deflection",
  "system.attributes.ac.bonuses.insight",
  "system.attributes.ac.bonuses.luck",
  "system.attributes.ac.bonuses.sacred",
  "system.attributes.ac.bonuses.profane",
  "system.attributes.ac.bonuses.circumstance",
  "system.attributes.ac.bonuses.morale",
  "system.attributes.ac.bonuses.misc",
  "system.attributes.savingThrows.fort.effectBonus",
  "system.attributes.savingThrows.ref.effectBonus",
  "system.attributes.savingThrows.will.effectBonus",
  "system.attributes.bab.effectBonus",
  "system.attributes.grapple.effectBonus",
  "system.attributes.init.effectBonus",
  "system.attributes.speed.land.effectBonus",
  "... system.skills.<key>.effectBonus (e.g. system.skills.blf.effectBonus)",
];

/** @param {object} systemData */
export function resetActorEffectBuckets(systemData) {
  if (!systemData.attributes) systemData.attributes = {};
  if (!systemData.attributes.ac) systemData.attributes.ac = {};
  systemData.attributes.ac.bonuses ??= {};
  const acb = systemData.attributes.ac.bonuses;
  for (const k of ["dodge", "deflection", "insight", "luck", "sacred", "profane", "circumstance", "morale", "misc"]) {
    acb[k] = 0;
  }

  systemData.attributes.bab ??= {};
  systemData.attributes.bab.effectBonus = 0;

  systemData.attributes.grapple ??= {};
  systemData.attributes.grapple.effectBonus = 0;

  systemData.attributes.init ??= {};
  systemData.attributes.init.effectBonus = 0;

  systemData.attributes.speed ??= {};
  systemData.attributes.speed.land ??= {};
  systemData.attributes.speed.land.effectBonus = 0;

  const saves = systemData.attributes.savingThrows ?? {};
  for (const key of Object.keys(saves)) {
    saves[key].effectBonus = 0;
  }

  systemData.skills ??= {};
  for (const key of Object.keys(CTSDND35.skills)) {
    if (!systemData.skills[key]) systemData.skills[key] = { ranks: 0, misc: 0, classSkill: false };
    systemData.skills[key].effectBonus = 0;
  }
}
