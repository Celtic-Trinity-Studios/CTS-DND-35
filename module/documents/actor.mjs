/**
 * CTS DND 3.5 — Actor Document
 * Extends the base Actor class to implement system-specific logic.
 */

import { CTSDND35 } from "../helpers/config.mjs";
import { getAdjustedCarryingLimits, getLoadBandFromWeight } from "../helpers/carrying-capacity.mjs";
import { resetActorEffectBuckets } from "../helpers/modifier-pipeline.mjs";
import {
  bonusSpellsForScore,
  buildSpellDerived,
  buildWeaponDerived,
  normalizeAbilityKey,
  resolveClassCombatProgression,
  slugifyClassKey,
  summarizeConditions,
} from "../helpers/combat-rules.mjs";

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
    systemData.spellcasting.summary ??= [];
    systemData.attributes.encumbrance ??= {};
    if (!Array.isArray(systemData.attributes.dr)) systemData.attributes.dr = [];
    systemData.attributes.energy ??= {};
    systemData.attributes.energy.resist ??= {};
    systemData.attributes.energy.immune ??= {};
    for (const key of ["fire", "cold", "acid", "electricity", "sonic"]) {
      systemData.attributes.energy.resist[key] ??= 0;
      systemData.attributes.energy.immune[key] =
        systemData.attributes.energy.immune[key] === true ||
        systemData.attributes.energy.immune[key] === "true";
    }

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

    this._applyBuffItemModifiers(systemData);
    this._applyConditionModifiers(systemData, nl);
    this._prepareEncumbrance(systemData);

    this._prepareSpeed(systemData);
    this._prepareCombatStats(systemData, nl);
    this._prepareSkills(systemData, nl);
    this._prepareSpellcasting(systemData);
    this._prepareAttacksAndSpells(systemData);

    systemData.details.xpMulticlassHint = this._multiclassXpHint(actorData, systemData);
    systemData.attributes.hp.tempSourcesSum = this._sumTempHpSources(systemData);
  }

  /**
   * Condition score penalties are applied in _prepareAbilities. This pass adds check, AC, and speed flags.
   */
  _applyConditionModifiers(systemData, nl) {
    const flags = systemData.attributes.conditionFlags || summarizeConditions(systemData.details?.status?.conditions);
    systemData.attributes.conditionFlags = flags;
    systemData.attributes.conditionNotes = flags.notes;
    const check = Math.floor(flags.checkPenalty) || 0;
    for (const key of ["fort", "ref", "will"]) {
      const save = systemData.attributes.savingThrows[key];
      if (save) save.effectBonus -= check;
    }
    systemData.attributes.attackRollPenalty = nl + (Math.floor(flags.attackPenalty) || 0);
    systemData.attributes.damageRollPenalty = Math.floor(flags.damagePenalty) || 0;
    systemData.attributes.abilityCheckPenalty = check;
    systemData.attributes.speed.land.conditionHalves = Math.floor(flags.speedHalves) || 0;
    systemData.attributes.ac.conditionPenalty = Math.floor(flags.acPenalty) || 0;
    systemData.attributes.ac.dexMode = flags.dexMode || "normal";
    systemData.attributes.ac.prone = !!flags.prone;
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

    const flags = summarizeConditions(systemData.details?.status?.conditions);
    systemData.attributes.conditionFlags = flags;
    const str = systemData.abilities.str;
    const dex = systemData.abilities.dex;
    if (str && flags.strPen) {
      str.effective = Math.max(1, str.effective - flags.strPen);
      str.mod = Math.floor((str.effective - 10) / 2);
    }
    if (dex && flags.dexPen) {
      dex.effective = Math.max(1, dex.effective - flags.dexPen);
      dex.mod = Math.floor((dex.effective - 10) / 2);
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
    const halves = Math.max(0, Math.floor(Number(systemData.attributes.speed.land.conditionHalves) || 0));
    for (let i = 0; i < halves; i++) land = Math.floor(land / 2);
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
    let totalBAB = 0;
    const classSave = { fort: 0, ref: 0, will: 0 };
    let anyClassSave = false;
    const classItems = this.items.filter((i) => i.type === "class");
    for (const cls of classItems) {
      const level = Math.floor(Number(cls.system.level) || 0);
      const progression = resolveClassCombatProgression(cls.name, cls.system);
      const babTable = CTSDND35.babProgression[progression.bab] || CTSDND35.babProgression.med;
      if (level > 0) totalBAB += babTable[Math.min(level, 20) - 1] || 0;
      if (level <= 0) continue;
      for (const key of ["fort", "ref", "will"]) {
        const prog = progression.saves[key] === "high" ? "high" : "low";
        const table = CTSDND35.saveProgression[prog];
        classSave[key] += table[Math.min(level, 20) - 1] || 0;
        anyClassSave = true;
      }
    }

    const saves = systemData.attributes?.savingThrows ?? {};
    for (const [key, save] of Object.entries(saves)) {
      const abilityMod = systemData.abilities[save.ability]?.mod || 0;
      save.classBase = classSave[key] || 0;
      save.baseFromClasses = anyClassSave;
      const baseUsed = anyClassSave ? save.classBase : Math.floor(Number(save.base) || 0);
      save.baseUsed = baseUsed;
      save.total =
        baseUsed +
        abilityMod +
        (save.bonus || 0) +
        Math.floor(Number(save.effectBonus) || 0) -
        nl;
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

    const dexMode = systemData.attributes.ac.dexMode || "normal";
    let dexForAc = dexMod;
    if (dexMode === "helpless") dexForAc = -5;
    else if (dexMode === "loseBonus") dexForAc = Math.min(0, dexMod);
    const effCap = systemData.attributes.ac.effectiveMaxDex;
    const effectiveDex =
      effCap != null && Number.isFinite(effCap) ? Math.min(dexForAc, effCap) : dexForAc;
    const acCondition = Math.floor(Number(systemData.attributes.ac.conditionPenalty) || 0);

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
      bonusAcSum -
      acCondition;
    systemData.attributes.ac.touch = 10 + effectiveDex + sizeMods.attack + bonusAcSum - acCondition;
    systemData.attributes.ac.flatFooted =
      10 + armorBonus + shieldBonus + sizeMods.attack + naturalArmor + flatFootedBonusAc - acCondition;
    if (systemData.attributes.ac.prone) {
      systemData.attributes.ac.vsMelee = systemData.attributes.ac.normal - 4;
      systemData.attributes.ac.vsRanged = systemData.attributes.ac.normal + 4;
    } else {
      systemData.attributes.ac.vsMelee = systemData.attributes.ac.normal;
      systemData.attributes.ac.vsRanged = systemData.attributes.ac.normal;
    }

    const conditionAttack = Math.floor(Number(systemData.attributes.conditionFlags?.attackPenalty) || 0);
    const abilityCheckPenalty = Math.floor(Number(systemData.attributes.abilityCheckPenalty) || 0);
    systemData.attributes.init.total =
      (systemData.abilities.dex?.mod || 0) +
      (systemData.attributes.init.bonus || 0) +
      Math.floor(Number(systemData.attributes.init.effectBonus) || 0) -
      nl -
      abilityCheckPenalty;

    systemData.attributes.grapple.total =
      totalBAB +
      (systemData.abilities.str?.mod || 0) +
      (sizeMods.grapple || 0) +
      Math.floor(Number(systemData.attributes.grapple.effectBonus) || 0) -
      nl -
      conditionAttack;
  }

  /**
   * Prepare skills: ensure all skills from config exist and compute totals.
   * @param {number} nl
   */
  _prepareSkills(systemData, nl) {
    if (!systemData.skills) systemData.skills = {};

    const penMag = Math.floor(Number(systemData.attributes.skillsCheckPenaltyMag) || 0);
    const conditionPen = Math.floor(Number(systemData.attributes.conditionFlags?.checkPenalty) || 0);

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
        conditionPen -
        nl;
    }
  }

  _prepareSpellcasting(systemData) {
    const stored = systemData.spellcasting.classes || {};
    const merged = {};
    for (const [key, row] of Object.entries(stored)) {
      merged[key] = { ...row };
    }
    for (const item of this.items) {
      if (item.type !== "class") continue;
      const type = String(item.system.spellcasting?.type || "none").toLowerCase();
      if (!type || type === "none") continue;
      const progression = resolveClassCombatProgression(item.name, item.system);
      const key = slugifyClassKey(item.name) || "class";
      const level = Math.max(0, Math.floor(Number(item.system.level) || 0));
      const existing = merged[key] || {};
      const storedPerDay = existing.spellsPerDay || {};
      const hasStored = Object.values(storedPerDay).some((n) => Number(n) > 0);
      let spellsPerDay = storedPerDay;
      if (!hasStored) {
        let table = item.system.spellcasting?.progression || item.system.spellcasting?.spellsPerDayByLevel || {};
        if (typeof table === "string") {
          try {
            table = JSON.parse(table);
          } catch {
            table = {};
          }
        }
        const levelRow = table?.[level] || table?.[String(level)] || {};
        spellsPerDay = levelRow.spellsPerDay || levelRow.perDay || {};
      }
      merged[key] = {
        ...existing,
        className: existing.className || item.name,
        type: existing.type || type,
        ability: existing.ability || item.system.spellcasting?.ability || progression.ability || "",
        classLevel: level || existing.classLevel || 0,
        casterLevel: existing.casterLevel || level || 0,
        spellsPerDay,
        spellsKnown: existing.spellsKnown || {},
        expended: existing.expended || {},
      };
    }

    const summary = [];
    for (const [key, row] of Object.entries(merged)) {
      const ability = normalizeAbilityKey(row.ability) || normalizeAbilityKey(resolveClassCombatProgression(row.className, {}).ability);
      const score = systemData.abilities[ability]?.effective ?? 10;
      const abilityMod = systemData.abilities[ability]?.mod || 0;
      const perDay = [];
      const baseMap = row.spellsPerDay || {};
      const hasTable = Object.values(baseMap).some((n) => Number(n) > 0);
      for (let level = 0; level <= 9; level++) {
        const base = Math.max(0, Math.floor(Number(baseMap[level] ?? baseMap[String(level)]) || 0));
        const bonus = hasTable && base > 0 && level > 0 && ability ? bonusSpellsForScore(score, level) : 0;
        if (hasTable && level > 0 && base <= 0) continue;
        if (!hasTable && level > 0) continue;
        const total = base + (level === 0 ? 0 : bonus);
        const expended = Math.max(0, Math.floor(Number(row.expended?.[level] ?? row.expended?.[String(level)]) || 0));
        perDay.push({
          level,
          base,
          bonus,
          total,
          expended,
          remaining: Math.max(0, total - expended),
          dc: 10 + level + abilityMod,
        });
      }
      if (!hasTable) {
        for (let level = 1; level <= 9; level++) {
          perDay.push({
            level,
            base: 0,
            bonus: 0,
            total: 0,
            expended: 0,
            remaining: 0,
            dc: 10 + level + abilityMod,
          });
        }
      }
      summary.push({
        key,
        className: row.className || key,
        type: row.type || "",
        ability,
        abilityMod,
        casterLevel: Math.floor(Number(row.casterLevel ?? row.classLevel) || 0),
        perDay,
      });
    }
    systemData.spellcasting.summary = summary;
  }

  _prepareAttacksAndSpells(systemData) {
    const sizeKey = systemData.traits?.size || "med";
    const sizeMods = CTSDND35.sizeMods[sizeKey] || CTSDND35.sizeMods.med;
    const mods = {};
    for (const [key, ability] of Object.entries(systemData.abilities || {})) mods[key] = ability.mod || 0;
    const ctx = {
      bab: systemData.attributes.bab.total || 0,
      strMod: mods.str || 0,
      dexMod: mods.dex || 0,
      mods,
      sizeAttack: sizeMods.attack || 0,
      attackPenalty: systemData.attributes.attackRollPenalty || 0,
      damagePenalty: systemData.attributes.damageRollPenalty || 0,
      cannotAttack: !!systemData.attributes.conditionFlags?.cannotAttack,
    };
    const summary = systemData.spellcasting.summary || [];
    for (const item of this.items) {
      if (item.type === "weapon" || item.type === "attack") {
        item.system.derived = buildWeaponDerived(item.system, ctx);
      } else if (item.type === "spell") {
        item.system.derived = buildSpellDerived(item.system, summary, systemData);
      }
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
