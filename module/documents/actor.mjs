/**
 * CTS DND 3.5 — Actor Document
 * Extends the base Actor class to implement system-specific logic.
 */

import { CTSDND35 } from "../helpers/config.mjs";

export class CTSDND35Actor extends Actor {

  _ensureSystemData(systemData) {
    if (!systemData) return;

    systemData.abilities ??= {};
    for (const key of Object.keys(CTSDND35.abilities)) {
      systemData.abilities[key] ??= { value: 10, mod: 0, bonus: 0, damage: 0, drain: 0, aging: 0 };
      systemData.abilities[key].value ??= 10;
      systemData.abilities[key].mod ??= 0;
      systemData.abilities[key].bonus ??= 0;
      systemData.abilities[key].damage ??= 0;
      systemData.abilities[key].drain ??= 0;
      systemData.abilities[key].aging ??= 0;
    }

    systemData.attributes ??= {};
    systemData.attributes.hp ??= { value: 0, max: 0, temp: 0, nonlethal: 0, tempSources: [] };
    systemData.attributes.hp.tempSources ??= [];
    systemData.attributes.negativeLevels ??= 0;
    systemData.attributes.ac ??= { normal: 10, touch: 10, flatFooted: 10, naturalArmor: 0 };
    systemData.attributes.init ??= { value: 0, bonus: 0, total: 0 };
    systemData.attributes.bab ??= { value: 0, total: 0, attackPenalty: 0 };
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
      will: { base: 0, ability: "wis", bonus: 0, total: 0 },
    };

    systemData.details ??= {};
    systemData.details.level ??= { value: 0, xp: 0, xpNext: 0 };
    systemData.details.race ??= "";
    systemData.details.alignment ??= "";
    systemData.details.deity ??= "";
    systemData.details.groups ??= "";
    systemData.details.factionAffiliations ??= [];
    systemData.details.raceTradeMods ??= [];
    systemData.details.raceModsSelling ??= [];
    systemData.details.biography ??= "";
    systemData.details.notes ??= "";
    systemData.details.age ??= "";
    systemData.details.height ??= "";
    systemData.details.weight ??= "";
    systemData.details.eyes ??= "";
    systemData.details.hair ??= "";
    systemData.details.languages ??= "";
    systemData.details.literate ??= true;
    systemData.details.favoredClass ??= "";
    systemData.details.racialFavoredClass ??= "";
    systemData.details.laBuyoffXp ??= 0;
    systemData.details.creatureType ??= "";
    systemData.details.creatureSubtype ??= "";
    systemData.details.humanoidSubtype ??= "";
    systemData.details.status ??= { notes: "", vitality: "normal", conditions: {} };
    systemData.details.status.notes ??= "";
    systemData.details.status.vitality ??= "normal";
    systemData.details.status.conditions ??= {};
    for (const { key } of CTSDND35.statusConditions) {
      systemData.details.status.conditions[key] ??= false;
      systemData.details.status.conditions[key] =
        systemData.details.status.conditions[key] === true ||
        systemData.details.status.conditions[key] === "true";
    }

    // Legacy XP field used by older templates — mirror into level.xp once.
    if (systemData.details.xpValue != null && Number(systemData.details.level?.xp) === 0) {
      systemData.details.level.xp = Number(systemData.details.xpValue) || 0;
    }

    systemData.traits ??= {};
    systemData.traits.size ??= "med";
    systemData.traits.reachOverride ??= null;
    systemData.traits.encumbrance ??= "none";
    systemData.traits.difficultTerrain =
      systemData.traits.difficultTerrain === true ||
      systemData.traits.difficultTerrain === "true";
    systemData.traits.senses ??= {
      darkvision: 0,
      lowLightVision: false,
      blindsense: 0,
      blindsight: 0,
      tremorsense: 0,
      scent: false,
      notes: "",
    };
    systemData.traits.polymorph ??= {
      enabled: false,
      str: 10,
      dex: 10,
      con: 10,
      notes: "",
    };

    systemData.details.literate =
      systemData.details.literate === true || systemData.details.literate === "true";
    systemData.traits.senses.lowLightVision =
      systemData.traits.senses.lowLightVision === true ||
      systemData.traits.senses.lowLightVision === "true";
    systemData.traits.senses.scent =
      systemData.traits.senses.scent === true || systemData.traits.senses.scent === "true";
    systemData.traits.polymorph.enabled =
      systemData.traits.polymorph.enabled === true ||
      systemData.traits.polymorph.enabled === "true";

    systemData.currency ??= { cp: 0, sp: 0, gp: 0, pp: 0 };
    systemData.skills ??= {};
    systemData.spellcasting ??= {};
    systemData.spellcasting.classes ??= {};
  }

  /**
   * @override
   * Compute derived data after items and effects are applied.
   */
  prepareDerivedData() {
    const actorData = this;
    const systemData = actorData.system;
    this._ensureSystemData(systemData);

    this._prepareAbilities(systemData);

    if (actorData.type === "character") this._prepareCharacterData(actorData, systemData);
    if (actorData.type === "npc") this._prepareNpcData(actorData, systemData);

    const nl = Math.max(0, Math.floor(Number(systemData.attributes?.negativeLevels) || 0));
    systemData.attributes.negativeLevels = nl;
    systemData.attributes.attackRollPenalty = nl;

    this._prepareSpeed(systemData);
    this._prepareCombatStats(systemData, nl);
    this._prepareSkills(systemData, nl);

    systemData.details.xpMulticlassHint = this._multiclassXpHint(actorData, systemData);
    systemData.attributes.hp.tempSourcesSum = this._sumTempHpSources(systemData);
  }

  _sumTempHpSources(systemData) {
    const arr = systemData.attributes?.hp?.tempSources;
    if (!Array.isArray(arr)) return 0;
    return arr.reduce((s, row) => s + (Math.floor(Number(row?.amount)) || 0), 0);
  }

  /**
   * PHB multiclass XP penalty is table-heavy; surface a short reminder when multiclassed.
   */
  _multiclassXpHint(actorData, systemData) {
    const classes = actorData.items.filter((i) => i.type === "class" && (i.system.level || 0) > 0);
    if (classes.length <= 1) return "";
    const names = classes.map((c) => c.name).join(", ");
    const fav = String(systemData.details?.favoredClass || "").trim();
    const rfav = String(systemData.details?.racialFavoredClass || "").trim();
    const favNote = fav ? `Favored class (chosen): ${fav}. ` : rfav ? `Racial favored: ${rfav}. ` : "Set favored class on Identity. ";
    return `${favNote}Classes: ${names}. Verify XP penalty vs PHB Table 3–6 when levels diverge.`;
  }

  /**
   * Effective score for one ability (polymorph replaces physical Str/Dex/Con when enabled).
   */
  _effectiveAbilityScore(key, ability, systemData) {
    const poly = systemData.traits?.polymorph;
    const usePoly = poly?.enabled && (key === "str" || key === "dex" || key === "con");
    const penal =
      Math.floor(Number(ability.damage) || 0) +
      Math.floor(Number(ability.drain) || 0) +
      Math.floor(Number(ability.aging) || 0);
    if (usePoly) {
      const baseScore = Math.max(1, Math.floor(Number(poly[key]) || 10));
      return Math.max(1, baseScore - penal);
    }
    const combined = (Number(ability.value) || 10) + (Number(ability.bonus) || 0);
    return Math.max(1, Math.floor(combined - penal));
  }

  /**
   * Calculate ability modifiers from effective scores.
   * @param {object} systemData
   */
  _prepareAbilities(systemData) {
    for (const [key, ability] of Object.entries(systemData.abilities ?? {})) {
      const eff = this._effectiveAbilityScore(key, ability, systemData);
      ability.effective = eff;
      ability.mod = Math.floor((eff - 10) / 2);
    }
  }

  /**
   * Prepare Character-specific derived data.
   */
  _prepareCharacterData(actorData, systemData) {
    const classItems = actorData.items.filter((i) => i.type === "class");
    let totalLevel = 0;
    for (const cls of classItems) {
      totalLevel += cls.system.level || 0;
    }
    systemData.details.level.value = totalLevel;
  }

  /**
   * Prepare NPC-specific derived data.
   */
  _prepareNpcData(_actorData, _systemData) {
    // Derive XP from CR if desired
  }

  _armorSpeedPenaltyFt() {
    let pen = 0;
    const armorItems = this.items.filter((i) => i.type === "armor");
    for (const armor of armorItems) {
      if (!armor.system.equipped) continue;
      if (armor.system.armorType === "shield") continue;
      let sp = armor.system.speedPenalty;
      if (sp == null || sp === "") {
        const t = armor.system.armorType;
        if (t === "heavy") sp = 10;
        else if (t === "medium") sp = 5;
        else sp = 0;
      }
      pen += Math.max(0, Number(sp) || 0);
    }
    return pen;
  }

  _prepareSpeed(systemData) {
    const landBase = Math.max(0, Number(systemData.attributes.speed.land.base) || 0);
    const armorPen = this._armorSpeedPenaltyFt();
    let land = Math.max(5, landBase - armorPen);

    const enc = String(systemData.traits?.encumbrance || "none");
    if (enc === "medium") land = Math.max(5, Math.floor((land * 2) / 3));
    else if (enc === "heavy" || enc === "overload") land = Math.max(5, Math.floor(land / 2));

    if (systemData.traits?.difficultTerrain) land = Math.max(5, Math.floor(land / 2));

    systemData.attributes.speed.land.total = land;
    systemData.attributes.speed.land.armorPenaltyFt = armorPen;

    const fly = Math.max(0, Number(systemData.attributes.speed.fly.base) || 0);
    systemData.attributes.speed.fly.total = fly;
    const swim = Math.max(0, Number(systemData.attributes.speed.swim.base) || 0);
    systemData.attributes.speed.swim.total = swim;
    const climb = Math.max(0, Number(systemData.attributes.speed.climb.base) || 0);
    systemData.attributes.speed.climb.total = climb;
    const burrow = Math.max(0, Number(systemData.attributes.speed.burrow.base) || 0);
    systemData.attributes.speed.burrow.total = burrow;

    const sizeKey = systemData.traits?.size || "med";
    const defaultReach = CTSDND35.sizeReachFt[sizeKey] ?? CTSDND35.sizeReachFt.med;
    const ro = systemData.traits.reachOverride;
    systemData.traits.reachFt =
      ro != null && ro !== "" ? Math.max(0, Number(ro) || 0) : defaultReach;
  }

  /**
   * Calculate saving throws, initiative, AC, BAB, grapple from items and abilities.
   * @param {number} nl negative levels
   */
  _prepareCombatStats(systemData, nl) {
    const saves = systemData.attributes?.savingThrows ?? {};
    for (const [, save] of Object.entries(saves)) {
      const abilityMod = systemData.abilities[save.ability]?.mod || 0;
      save.total = (save.base || 0) + abilityMod + (save.bonus || 0) - nl;
    }

    let totalBAB = 0;
    const classItems = this.items.filter((i) => i.type === "class");
    for (const cls of classItems) {
      const level = cls.system.level || 0;
      const progression = cls.system.bab || "med";
      const table = CTSDND35.babProgression[progression] || CTSDND35.babProgression.med;
      totalBAB += table[level - 1] || 0;
    }
    systemData.attributes.bab.total = totalBAB;
    systemData.attributes.bab.attackPenalty = nl;

    const sizeKey = systemData.traits?.size || "med";
    const sizeMods = CTSDND35.sizeMods[sizeKey] || CTSDND35.sizeMods.med;

    const dexMod = systemData.abilities.dex?.mod || 0;
    const naturalArmor = systemData.attributes.ac.naturalArmor || 0;

    let armorBonus = 0;
    let shieldBonus = 0;
    let lowestMaxDex = Infinity;
    const armorItems = this.items.filter((i) => i.type === "armor");
    for (const armor of armorItems) {
      if (!armor.system.equipped) continue;
      const bonus = (armor.system.acBonus || 0) + (armor.system.enhancement || 0);
      if (armor.system.armorType === "shield") {
        shieldBonus += bonus;
      } else {
        armorBonus += bonus;
      }
      if (armor.system.maxDex != null && armor.system.maxDex < lowestMaxDex) {
        lowestMaxDex = armor.system.maxDex;
      }
    }

    const effectiveDex = lowestMaxDex < Infinity ? Math.min(dexMod, lowestMaxDex) : dexMod;

    systemData.attributes.ac.normal =
      10 + armorBonus + shieldBonus + effectiveDex + sizeMods.attack + naturalArmor;
    systemData.attributes.ac.touch = 10 + effectiveDex + sizeMods.attack;
    systemData.attributes.ac.flatFooted = 10 + armorBonus + shieldBonus + sizeMods.attack + naturalArmor;

    systemData.attributes.init.total =
      (systemData.abilities.dex?.mod || 0) + (systemData.attributes.init.bonus || 0) - nl;

    systemData.attributes.grapple.total =
      totalBAB + (systemData.abilities.str?.mod || 0) + (sizeMods.grapple || 0) - nl;
  }

  /**
   * Prepare skills: ensure all skills from config exist and compute totals.
   * @param {number} nl
   */
  _prepareSkills(systemData, nl) {
    if (!systemData.skills) systemData.skills = {};

    for (const [key, skillDef] of Object.entries(CTSDND35.skills)) {
      if (!systemData.skills[key]) {
        systemData.skills[key] = { ranks: 0, misc: 0, classSkill: false };
      }
      const skill = systemData.skills[key];
      const abilityMod = systemData.abilities[skillDef.ability]?.mod || 0;
      skill.total = (skill.ranks || 0) + abilityMod + (skill.misc || 0) - nl;
    }
  }

  /**
   * Override getRollData() to inject system data into roll formulas.
   */
  getRollData() {
    const data = { ...super.getRollData() };

    if (data.abilities) {
      for (const [k, v] of Object.entries(data.abilities)) {
        data[`abl_${k}`] = v.effective ?? v.value;
        data[`mod_${k}`] = v.mod;
      }
    }

    return data;
  }
}
