/**
 * CTS DND 35 — Actor Document
 * Extends the base Actor class to implement system-specific logic.
 */

import { CTSDND35 } from "../helpers/config.mjs";
export class CTSDND35Actor extends Actor {

  _ensureSystemData(systemData) {
    if (!systemData) return;

    systemData.abilities ??= {};
    for (const key of Object.keys(CTSDND35.abilities)) {
      systemData.abilities[key] ??= { value: 10, mod: 0, bonus: 0 };
      systemData.abilities[key].value ??= 10;
      systemData.abilities[key].mod ??= 0;
      systemData.abilities[key].bonus ??= 0;
    }

    systemData.attributes ??= {};
    systemData.attributes.hp ??= { value: 0, max: 0, temp: 0, nonlethal: 0 };
    systemData.attributes.ac ??= { normal: 10, touch: 10, flatFooted: 10, naturalArmor: 0 };
    systemData.attributes.init ??= { value: 0, bonus: 0, total: 0 };
    systemData.attributes.bab ??= { value: 0, total: 0 };
    systemData.attributes.grapple ??= { value: 0, total: 0 };
    systemData.attributes.sr ??= { value: 0, formula: "" };
    systemData.attributes.speed ??= {};
    systemData.attributes.speed.land ??= { base: 30, total: 30 };
    systemData.attributes.speed.fly ??= { base: 0, total: 0, maneuverability: "average" };
    systemData.attributes.speed.swim ??= { base: 0, total: 0 };
    systemData.attributes.speed.climb ??= { base: 0, total: 0 };
    systemData.attributes.speed.burrow ??= { base: 0, total: 0 };
    systemData.attributes.savingThrows ??= {
      fort: { base: 0, ability: "con", bonus: 0, total: 0 },
      ref: { base: 0, ability: "dex", bonus: 0, total: 0 },
      will: { base: 0, ability: "wis", bonus: 0, total: 0 }
    };

    systemData.details ??= {};
    systemData.details.level ??= { value: 0, xp: 0, xpNext: 0 };
    systemData.details.race ??= "";
    systemData.details.alignment ??= "";
    systemData.details.deity ??= "";
    systemData.details.biography ??= "";
    systemData.details.notes ??= "";

    systemData.traits ??= {};
    systemData.traits.size ??= "med";
    systemData.currency ??= { cp: 0, sp: 0, gp: 0, pp: 0 };
    systemData.skills ??= {};
  }

  /**
   * @override
   * Compute derived data after items and effects are applied.
   */
  prepareDerivedData() {
    const actorData = this;
    const systemData = actorData.system;
    const flags = actorData.flags.ctsdnd35 || {};
    this._ensureSystemData(systemData);

    // Compute ability modifiers
    this._prepareAbilities(systemData);

    // Route based on actor type
    if (actorData.type === "character") this._prepareCharacterData(actorData, systemData);
    if (actorData.type === "npc") this._prepareNpcData(actorData, systemData);

    // Compute combat stats
    this._prepareCombatStats(systemData);

    // Compute skill totals
    this._prepareSkills(systemData);
  }

  /**
   * Calculate ability modifiers from ability scores.
   * @param {object} systemData
   */
  _prepareAbilities(systemData) {
    for (const [key, ability] of Object.entries(systemData.abilities ?? {})) {
      ability.mod = Math.floor((ability.value - 10) / 2);
    }
  }

  /**
   * Prepare Character-specific derived data.
   */
  _prepareCharacterData(actorData, systemData) {
    // Compute total level from class items
    const classItems = actorData.items.filter(i => i.type === "class");
    let totalLevel = 0;
    for (const cls of classItems) {
      totalLevel += cls.system.level || 0;
    }
    systemData.details.level.value = totalLevel;
  }

  /**
   * Prepare NPC-specific derived data.
   */
  _prepareNpcData(actorData, systemData) {
    // Derive XP from CR if desired
  }

  /**
   * Calculate saving throws, initiative, AC, BAB, grapple from items and abilities.
   */
  _prepareCombatStats(systemData) {
    // --- Saving Throws ---
    const saves = systemData.attributes?.savingThrows ?? {};
    for (const [key, save] of Object.entries(saves)) {
      const abilityMod = systemData.abilities[save.ability]?.mod || 0;
      save.total = (save.base || 0) + abilityMod + (save.bonus || 0);
    }

    // --- BAB from class items ---
    let totalBAB = 0;
    const classItems = this.items.filter(i => i.type === "class");
    for (const cls of classItems) {
      const level = cls.system.level || 0;
      const progression = cls.system.bab || "med";
      const table = CTSDND35.babProgression[progression] || CTSDND35.babProgression.med;
      totalBAB += (table[level - 1] || 0);
    }
    systemData.attributes.bab.total = totalBAB;

    // --- Size modifier ---
    const sizeKey = systemData.traits?.size || "med";
    const sizeMods = CTSDND35.sizeMods[sizeKey] || CTSDND35.sizeMods.med;

    // --- AC Calculation ---
    const dexMod = systemData.abilities.dex?.mod || 0;
    const naturalArmor = systemData.attributes.ac.naturalArmor || 0;

    // Sum armor and shield bonuses from equipped items
    let armorBonus = 0;
    let shieldBonus = 0;
    let lowestMaxDex = Infinity;
    const armorItems = this.items.filter(i => i.type === "armor");
    for (const armor of armorItems) {
      if (!armor.system.equipped) continue;
      const bonus = (armor.system.acBonus || 0) + (armor.system.enhancement || 0);
      if (armor.system.armorType === "shield") {
        shieldBonus += bonus;
      } else {
        armorBonus += bonus;
      }
      // Track max DEX cap from armor
      if (armor.system.maxDex != null && armor.system.maxDex < lowestMaxDex) {
        lowestMaxDex = armor.system.maxDex;
      }
    }

    // Cap DEX mod by armor's max dex bonus
    const effectiveDex = lowestMaxDex < Infinity ? Math.min(dexMod, lowestMaxDex) : dexMod;

    // AC = 10 + armor + shield + DEX (capped) + size + natural armor
    systemData.attributes.ac.normal = 10 + armorBonus + shieldBonus + effectiveDex + sizeMods.attack + naturalArmor;
    // Touch AC = 10 + DEX + size (no armor, shield, or natural)
    systemData.attributes.ac.touch = 10 + effectiveDex + sizeMods.attack;
    // Flat-Footed AC = 10 + armor + shield + size + natural (no DEX)
    systemData.attributes.ac.flatFooted = 10 + armorBonus + shieldBonus + sizeMods.attack + naturalArmor;

    // --- Initiative ---
    systemData.attributes.init.total =
      (systemData.abilities.dex?.mod || 0) +
      (systemData.attributes.init.bonus || 0);

    // --- Grapple = BAB + STR mod + size grapple mod ---
    systemData.attributes.grapple.total =
      totalBAB +
      (systemData.abilities.str?.mod || 0) +
      (sizeMods.grapple || 0);
  }

  /**
   * Prepare skills: ensure all skills from config exist and compute totals.
   */
  _prepareSkills(systemData) {
    if (!systemData.skills) systemData.skills = {};

    for (const [key, skillDef] of Object.entries(CTSDND35.skills)) {
      if (!systemData.skills[key]) {
        systemData.skills[key] = { ranks: 0, misc: 0, classSkill: false };
      }
      const skill = systemData.skills[key];
      const abilityMod = systemData.abilities[skillDef.ability]?.mod || 0;
      skill.total = (skill.ranks || 0) + abilityMod + (skill.misc || 0);
    }
  }

  /**
   * Override getRollData() to inject system data into roll formulas.
   */
  getRollData() {
    const data = { ...super.getRollData() };

    // Copy ability scores and mods to top level for convenience
    if (data.abilities) {
      for (const [k, v] of Object.entries(data.abilities)) {
        data[`abl_${k}`] = v.value;
        data[`mod_${k}`] = v.mod;
      }
    }

    return data;
  }
}
