/**
 * CTS DND 3.5 — Actor Document
 * Extends the base Actor class to implement system-specific logic.
 */

import { CTSDND35 } from "../helpers/config.mjs";
import { getAdjustedCarryingLimits, getLoadBandFromWeight } from "../helpers/carrying-capacity.mjs";
import { resetActorEffectBuckets } from "../helpers/modifier-pipeline.mjs";

export class CTSDND35Actor extends Actor {

  /**
   * Reset fields mutated by Active Effects before effects apply each preparation cycle.
   * @override
   */
  prepareBaseData() {
    super.prepareBaseData();
    if (!this.system) return;
    this._ensureSystemData(this.system);
    resetActorEffectBuckets(this.system);
  }

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
    systemData.attributes.ac.bonuses ??= {};
    systemData.attributes.init ??= { value: 0, bonus: 0, effectBonus: 0, total: 0 };
    systemData.attributes.bab ??= { value: 0, total: 0, attackPenalty: 0, effectBonus: 0 };
    systemData.attributes.grapple ??= { value: 0, total: 0, effectBonus: 0 };
    systemData.attributes.sr ??= { value: 0, formula: "" };
    systemData.attributes.speed ??= {};
    systemData.attributes.speed.land ??= { base: 30, total: 30, effectBonus: 0 };
    systemData.attributes.speed.fly ??= { base: 0, total: 0, maneuverability: "average" };
    systemData.attributes.speed.swim ??= { base: 0, total: 0 };
    systemData.attributes.speed.climb ??= { base: 0, total: 0 };
    systemData.attributes.speed.burrow ??= { base: 0, total: 0 };
    systemData.attributes.savingThrows ??= {
      fort: { base: 0, ability: "con", bonus: 0, effectBonus: 0, total: 0 },
      ref: { base: 0, ability: "dex", bonus: 0, effectBonus: 0, total: 0 },
      will: { base: 0, ability: "wis", bonus: 0, effectBonus: 0, total: 0 },
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
    systemData.spellcasting.arcaneSpellFailureTotal ??= 0;
    systemData.attributes.encumbrance ??= {};

    if (this.type === "npc") {
      systemData.merchant ??= {
        enabled: false,
        purchaseOnly: false,
        buyMultiplier: 1,
        sellMultiplier: 0.5,
      };
    }
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

    this._applyBuffItemModifiers(systemData);
    this._prepareEncumbrance(systemData);

    this._prepareSpeed(systemData);
    this._prepareCombatStats(systemData, nl);
    this._prepareSkills(systemData, nl);

    systemData.details.xpMulticlassHint = this._multiclassXpHint(actorData, systemData);
    systemData.attributes.hp.tempSourcesSum = this._sumTempHpSources(systemData);
  }

  /**
   * Sum numeric modifiers from Buff items marked active (parallel to Active Effects).
   */
  _applyBuffItemModifiers(systemData) {
    const acb = systemData.attributes.ac.bonuses;
    const nz = (x) => Math.floor(Number(x) || 0);
    for (const item of this.items) {
      if (item.type !== "buff") continue;
      const active = item.system.active === true || item.system.active === "true";
      if (!active) continue;
      const m = item.system.modifiers || {};
      acb.dodge += nz(m.dodge);
      acb.deflection += nz(m.deflection);
      acb.insight += nz(m.insight);
      acb.luck += nz(m.luck);
      acb.sacred += nz(m.sacred);
      acb.profane += nz(m.profane);
      acb.circumstance += nz(m.circumstance);
      acb.morale += nz(m.morale);
      acb.misc += nz(m.ac) + nz(m.acMisc);
      systemData.attributes.savingThrows.fort.effectBonus += nz(m.fort);
      systemData.attributes.savingThrows.ref.effectBonus += nz(m.ref);
      systemData.attributes.savingThrows.will.effectBonus += nz(m.will);
      systemData.attributes.init.effectBonus += nz(m.init);
      systemData.attributes.bab.effectBonus += nz(m.bab);
      systemData.attributes.grapple.effectBonus += nz(m.grapple);
      systemData.attributes.speed.land.effectBonus += nz(m.landSpeed);
      const allSk = nz(m.allSkills);
      if (allSk) {
        for (const key of Object.keys(CTSDND35.skills)) {
          systemData.skills[key].effectBonus += allSk;
        }
      }
      const sk = m.skills || {};
      if (sk && typeof sk === "object") {
        for (const [k, v] of Object.entries(sk)) {
          if (systemData.skills[k]) systemData.skills[k].effectBonus += nz(v);
        }
      }
    }
  }

  _inventoryWeightLb() {
    const types = new Set(["weapon", "armor", "equipment", "consumable"]);
    let sum = 0;
    for (const item of this.items) {
      if (!types.has(item.type)) continue;
      const wt = Math.max(0, Number(item.system.weight) || 0);
      const qty = Math.max(1, Math.floor(Number(item.system.quantity) || 1));
      sum += wt * qty;
    }
    return sum;
  }

  static _normalizeCheckPenaltyMag(raw) {
    const n = Number(raw);
    if (!Number.isFinite(n) || n === 0) return 0;
    return Math.abs(n);
  }

  /**
   * Equipped armor/shields: lowest max Dex (Infinity if uncapped), summed ACP magnitude, summed ASF %.
   */
  _equippedArmorDerived() {
    let lowestMaxDex = Number.POSITIVE_INFINITY;
    let acpSum = 0;
    let asfSum = 0;
    for (const armor of this.items.filter((i) => i.type === "armor")) {
      if (!armor.system.equipped) continue;
      if (armor.system.armorType === "shield") {
        acpSum += CTSDND35Actor._normalizeCheckPenaltyMag(armor.system.checkPenalty);
        asfSum += Math.max(0, Math.min(100, Number(armor.system.arcaneSpellFailure) || 0));
        continue;
      }
      const md = armor.system.maxDex;
      if (md != null && md !== "") {
        const cap = Math.max(0, Number(md));
        if (cap < lowestMaxDex) lowestMaxDex = cap;
      }
      acpSum += CTSDND35Actor._normalizeCheckPenaltyMag(armor.system.checkPenalty);
      asfSum += Math.max(0, Math.min(100, Number(armor.system.arcaneSpellFailure) || 0));
    }
    return { lowestMaxDex, acpSum, asfSum };
  }

  static _loadTierRank(t) {
    const o = { light: 0, medium: 1, heavy: 2, overload: 3, none: 0 };
    return o[t] ?? 0;
  }

  static _worseLoadTier(a, b) {
    return CTSDND35Actor._loadTierRank(a) >= CTSDND35Actor._loadTierRank(b) ? a : b;
  }

  _traitEncumbranceTier(systemData) {
    const e = String(systemData.traits?.encumbrance || "none");
    if (e === "overload") return "overload";
    if (e === "heavy") return "heavy";
    if (e === "medium") return "medium";
    return "light";
  }

  _armorBodyWorstTier() {
    let worst = "light";
    for (const armor of this.items.filter((i) => i.type === "armor")) {
      if (!armor.system.equipped || armor.system.armorType === "shield") continue;
      const t = armor.system.armorType;
      worst = CTSDND35Actor._worseLoadTier(worst, t === "heavy" ? "heavy" : t === "medium" ? "medium" : "light");
    }
    return worst;
  }

  /**
   * Resolve speed / max-Dex / check columns from encumbrance automation setting.
   */
  _resolveEncumbranceTiers(systemData, weightBand, mode) {
    const traitT = this._traitEncumbranceTier(systemData);
    const armorT = this._armorBodyWorstTier();

    if (mode === "manual") {
      return {
        speedTier: CTSDND35Actor._worseLoadTier(traitT, "light"),
        weightRuleTier: "light",
        displayWeightBand: weightBand,
      };
    }
    if (mode === "weight") {
      const speedTier = CTSDND35Actor._worseLoadTier(weightBand, armorT);
      return { speedTier, weightRuleTier: weightBand, displayWeightBand: weightBand };
    }
    const speedTier = CTSDND35Actor._worseLoadTier(CTSDND35Actor._worseLoadTier(weightBand, armorT), traitT);
    return { speedTier, weightRuleTier: weightBand, displayWeightBand: weightBand };
  }

  _prepareEncumbrance(systemData) {
    const strScore = systemData.abilities?.str?.effective ?? systemData.abilities?.str?.value ?? 10;
    const sizeKey = systemData.traits?.size || "med";
    const limits = getAdjustedCarryingLimits(strScore, sizeKey);
    const weightLb = this._inventoryWeightLb();
    const weightBand = getLoadBandFromWeight(weightLb, limits);
    const { lowestMaxDex, acpSum, asfSum } = this._equippedArmorDerived();

    const mode =
      typeof game !== "undefined" && game.settings?.get
        ? game.settings.get("CTS-DND-35", "encumbranceMode")
        : "merge";
    const loadBandForRules = mode === "manual" ? "light" : weightBand;
    const loadFx = CTSDND35.loadEncumbranceEffects[loadBandForRules] || CTSDND35.loadEncumbranceEffects.light;
    const loadMaxDexCap = loadFx.maxDexBonus === Number.POSITIVE_INFINITY ? Number.POSITIVE_INFINITY : loadFx.maxDexBonus;
    const armorDexCap = Number.isFinite(lowestMaxDex) ? lowestMaxDex : Number.POSITIVE_INFINITY;
    const effectiveMaxDexToAc = Math.min(armorDexCap, loadMaxDexCap);

    const loadCheckMag = loadFx.checkPenalty || 0;
    const effectiveCheckPenaltyMag = Math.max(acpSum, loadCheckMag);

    const tierInfo = this._resolveEncumbranceTiers(systemData, weightBand, mode);

    systemData.attributes.encumbrance = {
      weightLb,
      weightBand,
      lightMax: limits.lightMax,
      mediumMax: limits.mediumMax,
      heavyMax: limits.heavyMax,
      speedTier: tierInfo.speedTier,
      weightRuleTier: tierInfo.weightRuleTier,
      armorMaxDexCap: Number.isFinite(armorDexCap) ? armorDexCap : null,
      loadMaxDexCap: Number.isFinite(loadMaxDexCap) ? loadMaxDexCap : null,
      effectiveMaxDexToAc: Number.isFinite(effectiveMaxDexToAc) ? effectiveMaxDexToAc : null,
      armorCheckPenalty: acpSum,
      loadCheckPenalty: loadCheckMag,
      effectiveCheckPenaltyMag,
      arcaneSpellFailure: Math.min(100, asfSum),
    };

    systemData.spellcasting.arcaneSpellFailureTotal = systemData.attributes.encumbrance.arcaneSpellFailure;

    systemData.attributes.ac.effectiveMaxDex = Number.isFinite(effectiveMaxDexToAc) ? effectiveMaxDexToAc : null;
    systemData.attributes.skillsCheckPenaltyMag = effectiveCheckPenaltyMag;
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
    const speedArmor = Math.max(5, landBase - armorPen);

    const enc = systemData.attributes.encumbrance || {};
    const tier = enc.speedTier || "light";
    let speedLoad = landBase;
    if (tier === "overload") speedLoad = 5;
    else if (tier === "medium" || tier === "heavy") speedLoad = CTSDND35.speedFromLoadEncumbrance(landBase);

    let land = Math.max(5, Math.min(speedArmor, speedLoad));

    if (systemData.traits?.difficultTerrain) land = Math.max(5, Math.floor(land / 2));

    land += Math.floor(Number(systemData.attributes.speed.land.effectBonus) || 0);
    land = Math.max(5, land);

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
      save.total =
        (save.base || 0) +
        abilityMod +
        (save.bonus || 0) +
        Math.floor(Number(save.effectBonus) || 0) -
        nl;
    }

    let totalBAB = 0;
    const classItems = this.items.filter((i) => i.type === "class");
    for (const cls of classItems) {
      const level = cls.system.level || 0;
      const progression = cls.system.bab || "med";
      const table = CTSDND35.babProgression[progression] || CTSDND35.babProgression.med;
      totalBAB += table[level - 1] || 0;
    }
    totalBAB += Math.floor(Number(systemData.attributes.bab.effectBonus) || 0);
    systemData.attributes.bab.total = totalBAB;
    systemData.attributes.bab.attackPenalty = nl;

    const sizeKey = systemData.traits?.size || "med";
    const sizeMods = CTSDND35.sizeMods[sizeKey] || CTSDND35.sizeMods.med;

    const dexMod = systemData.abilities.dex?.mod || 0;
    const naturalArmor = systemData.attributes.ac.naturalArmor || 0;

    let armorBonus = 0;
    let shieldBonus = 0;
    const armorItems = this.items.filter((i) => i.type === "armor");
    for (const armor of armorItems) {
      if (!armor.system.equipped) continue;
      const bonus = (armor.system.acBonus || 0) + (armor.system.enhancement || 0);
      if (armor.system.armorType === "shield") {
        shieldBonus += bonus;
      } else {
        armorBonus += bonus;
      }
    }

    const effCap = systemData.attributes.ac.effectiveMaxDex;
    const effectiveDex =
      effCap != null && Number.isFinite(effCap) ? Math.min(dexMod, effCap) : dexMod;

    const bon = systemData.attributes.ac.bonuses || {};
    const dodgeBonus = Math.floor(Number(bon.dodge) || 0);
    const bonusAcSum =
      dodgeBonus +
      Math.floor(Number(bon.deflection) || 0) +
      Math.floor(Number(bon.insight) || 0) +
      Math.floor(Number(bon.luck) || 0) +
      Math.floor(Number(bon.sacred) || 0) +
      Math.floor(Number(bon.profane) || 0) +
      Math.floor(Number(bon.circumstance) || 0) +
      Math.floor(Number(bon.morale) || 0) +
      Math.floor(Number(bon.misc) || 0);
    const flatFootedBonusAc = bonusAcSum - dodgeBonus;

    systemData.attributes.ac.normal =
      10 +
      armorBonus +
      shieldBonus +
      effectiveDex +
      sizeMods.attack +
      naturalArmor +
      bonusAcSum;
    systemData.attributes.ac.touch = 10 + effectiveDex + sizeMods.attack + bonusAcSum;
    systemData.attributes.ac.flatFooted =
      10 + armorBonus + shieldBonus + sizeMods.attack + naturalArmor + flatFootedBonusAc;

    systemData.attributes.init.total =
      (systemData.abilities.dex?.mod || 0) +
      (systemData.attributes.init.bonus || 0) +
      Math.floor(Number(systemData.attributes.init.effectBonus) || 0) -
      nl;

    systemData.attributes.grapple.total =
      totalBAB +
      (systemData.abilities.str?.mod || 0) +
      (sizeMods.grapple || 0) +
      Math.floor(Number(systemData.attributes.grapple.effectBonus) || 0) -
      nl;
  }

  /**
   * Prepare skills: ensure all skills from config exist and compute totals.
   * @param {number} nl
   */
  _prepareSkills(systemData, nl) {
    if (!systemData.skills) systemData.skills = {};

    const penMag = Math.floor(Number(systemData.attributes.skillsCheckPenaltyMag) || 0);

    for (const [key, skillDef] of Object.entries(CTSDND35.skills)) {
      if (!systemData.skills[key]) {
        systemData.skills[key] = { ranks: 0, misc: 0, effectBonus: 0, classSkill: false };
      }
      const skill = systemData.skills[key];
      const abilityMod = systemData.abilities[skillDef.ability]?.mod || 0;
      let armorEncPen = 0;
      if (CTSDND35.skillsArmorCheck.has(key)) {
        armorEncPen = penMag * (key === "swm" ? 2 : 1);
      }
      skill.total =
        (skill.ranks || 0) +
        abilityMod +
        (skill.misc || 0) +
        Math.floor(Number(skill.effectBonus) || 0) -
        armorEncPen -
        nl;
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
