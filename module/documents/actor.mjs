/**
 * CTS DND 3.5 — Actor Document
 * Extends the base Actor class to implement system-specific logic.
 */

import { CTSDND35 } from "../helpers/config.mjs";
import { getAdjustedCarryingLimits, getLoadBandFromWeight } from "../helpers/carrying-capacity.mjs";
import { resetActorEffectBuckets } from "../helpers/modifier-pipeline.mjs";
import {
  agingAdjustments,
  classFeatureList,
  multiclassXpPenalty,
  paceSpeed,
  psionPowerPoints,
  slotLoad,
  experienceForCr,
  sneakDiceForClasses,
  synergyForSkill,
  xpToReachNextLevel,
} from "../helpers/open-rules.mjs";
import { critImmuneType, flurryPenalty, monkUnarmedDamage, skillTypedBonus, weaponSizePenalty } from "../helpers/phb-rest.mjs";
import { getClassFeatureGrants } from "../helpers/progression-rules.mjs";
import {
  bonusSpellsForScore,
  buildSpellDerived,
  buildWeaponDerived,
  normalizeAbilityKey,
  resolveClassCombatProgression,
  slugifyClassKey,
  summarizeConditions,
} from "../helpers/combat-rules.mjs";
import {
  analyzeFeats,
  creatureTypeNotes,
  preparationForClass,
  resolveRoundModifiers,
  resolveTwf,
  turningProfile,
} from "../helpers/table-combat.mjs";

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
    systemData.traits.applyRacialAdjustments =
      systemData.traits.applyRacialAdjustments === true ||
      systemData.traits.applyRacialAdjustments === "true";
    systemData.traits.applyAgingTable =
      systemData.traits.applyAgingTable === true ||
      systemData.traits.applyAgingTable === "true";
    systemData.details.ageCategory ??= "";

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
    systemData.attributes.combat ??= {};
    const combat = systemData.attributes.combat;
    combat.posture ??= "normal";
    combat.coverSelf ??= "none";
    combat.coverTarget ??= "none";
    combat.powerAttack ??= 0;
    combat.combatExpertise ??= 0;
    combat.aooSpent ??= 0;
    combat.concentrationDc ??= 15;
    combat.sneakAttack = combat.sneakAttack === true || combat.sneakAttack === "true";
    combat.manyshot = combat.manyshot === true || combat.manyshot === "true";
    combat.distracted = combat.distracted === true || combat.distracted === "true";
    combat.flurry = combat.flurry === true || combat.flurry === "true";
    combat.underwater = combat.underwater === true || combat.underwater === "true";
    combat.flatFooted = combat.flatFooted === true || combat.flatFooted === "true";
    combat.standardLeft = combat.standardLeft !== false && combat.standardLeft !== "false";
    combat.moveLeft = combat.moveLeft !== false && combat.moveLeft !== "false";
    combat.swiftLeft = combat.swiftLeft !== false && combat.swiftLeft !== "false";
    systemData.details.gestalt = systemData.details.gestalt === true || systemData.details.gestalt === "true";
    systemData.attributes.fortification = Math.max(0, Math.floor(Number(systemData.attributes.fortification) || 0));
    systemData.attributes.energy.vulnerable ??= {};
    for (const key of ["fire", "cold", "acid", "electricity", "sonic"]) {
      systemData.attributes.energy.vulnerable[key] =
        systemData.attributes.energy.vulnerable[key] === true ||
        systemData.attributes.energy.vulnerable[key] === "true";
    }
    combat.concealment = Math.max(0, Math.floor(Number(combat.concealment) || 0));
    systemData.attributes.turning ??= {};
    systemData.attributes.turning.expended ??= 0;

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
    this._applyFeatBonuses(systemData);
    this._applyConditionModifiers(systemData, nl);
    this._prepareEncumbrance(systemData);

    this._prepareSpeed(systemData);
    this._prepareCombatStats(systemData, nl);
    this._applyRoundModifiers(systemData);
    this._prepareSkills(systemData, nl);
    this._prepareSpellcasting(systemData);
    this._prepareAttacksAndSpells(systemData);
    systemData.attributes.typeNotes = creatureTypeNotes(systemData.details?.creatureType);

    this._prepareProgress(actorData, systemData);
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

  _applyFeatBonuses(systemData) {
    const feats = analyzeFeats(this.items);
    systemData.attributes.featProfile = feats;
    const notes = [];
    if (feats.improvedInitiative) {
      systemData.attributes.init.effectBonus += 4;
      notes.push("Improved Initiative +4");
    }
    if (feats.greatFortitude) {
      systemData.attributes.savingThrows.fort.effectBonus += 2;
      notes.push("Great Fortitude +2");
    }
    if (feats.lightningReflexes) {
      systemData.attributes.savingThrows.ref.effectBonus += 2;
      notes.push("Lightning Reflexes +2");
    }
    if (feats.ironWill) {
      systemData.attributes.savingThrows.will.effectBonus += 2;
      notes.push("Iron Will +2");
    }
    if (feats.dodge) {
      systemData.attributes.ac.bonuses.dodge += 1;
      notes.push("Dodge +1");
    }
    if (feats.combatCasting && systemData.skills?.con) {
      systemData.skills.con.effectBonus += 4;
      notes.push("Combat Casting +4 Concentration");
    }
    systemData.attributes.hp.toughnessBonus = feats.toughness * 3;
    if (feats.toughness) notes.push(`Toughness +${feats.toughness * 3} HP (add once to max HP)`);
    systemData.attributes.featNotes = notes;

    const dex = systemData.abilities?.dex?.mod || 0;
    const pool = feats.combatReflexes ? 1 + Math.max(0, dex) : 1;
    const spent = Math.max(0, Math.floor(Number(systemData.attributes.combat?.aooSpent) || 0));
    systemData.attributes.aoo = { pool, spent, remaining: Math.max(0, pool - spent) };
  }

  _applyRoundModifiers(systemData) {
    const feats = systemData.attributes.featProfile || {};
    const round = resolveRoundModifiers(systemData.attributes.combat, feats, systemData.attributes.bab?.total || 0);
    systemData.attributes.round = round;
    systemData.attributes.attackRollPenalty -= round.attack;
    const meleeBefore = systemData.attributes.ac.vsMelee;
    const rangedBefore = systemData.attributes.ac.vsRanged;
    systemData.attributes.ac.normal += round.dodge + round.ac;
    systemData.attributes.ac.touch += round.dodge + round.ac;
    systemData.attributes.ac.flatFooted += round.ac;
    const shift = round.dodge + round.ac;
    systemData.attributes.ac.vsMelee = (meleeBefore ?? systemData.attributes.ac.normal - shift) + shift;
    systemData.attributes.ac.vsRanged = (rangedBefore ?? systemData.attributes.ac.normal - shift) + shift;
    if (round.cannotAttack && systemData.attributes.conditionFlags) {
      systemData.attributes.conditionFlags.cannotAttack = true;
    }
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
    const fav = String(systemData.details?.favoredClass || systemData.details?.racialFavoredClass || "").trim();
    const penalty = systemData.details.xpPenalty || { percent: 0, counted: [] };
    const hit = penalty.percent ? `XP penalty ${penalty.percent}% (${penalty.counted.join(", ")}). ` : "No multiclass XP penalty at these levels. ";
    return `${hit}Favored: ${fav || "not set"}. Classes: ${names}.`;
  }

  _prepareProgress(actorData, systemData) {
    const level = Math.max(0, Math.floor(Number(systemData.details?.level?.value) || 0));
    systemData.details.level.xpNext = xpToReachNextLevel(Math.max(1, level));
    const classes = actorData.items
      .filter((item) => item.type === "class")
      .map((item) => ({ name: item.name, level: item.system?.level || 0 }));
    const favored = systemData.details?.favoredClass || systemData.details?.racialFavoredClass || "";
    systemData.details.xpPenalty = multiclassXpPenalty(classes, favored);
    systemData.attributes.classFeatures = classFeatureList(
      actorData.items.filter((item) => item.type === "class"),
      getClassFeatureGrants
    );
    systemData.attributes.slots = slotLoad(actorData.items);
    let powerPoints = 0;
    for (const row of classes) {
      let kind = "";
      let key = "";
      if (/psychic warrior/i.test(row.name)) {
        kind = "warrior";
        key = "wis";
      } else if (/wilder/i.test(row.name)) {
        kind = "wilder";
        key = "cha";
      } else if (/psion/i.test(row.name)) {
        kind = "psion";
        key = "int";
      }
      if (!kind) continue;
      powerPoints += psionPowerPoints(row.level, systemData.abilities?.[key]?.mod || 0, kind);
    }
    if (powerPoints) {
      systemData.spellcasting.powerPoints = powerPoints;
      const current = systemData.spellcasting.powerPointsCurrent;
      systemData.spellcasting.powerPointsCurrent = current == null || current === "" ? powerPoints : Math.max(0, Math.floor(Number(current) || 0));
    }
  }

  /**
   * Effective score for one ability (polymorph replaces physical Str/Dex/Con when enabled).
   */
  _effectiveAbilityScore(key, ability, systemData) {
    const poly = systemData.traits?.polymorph;
    const usePoly = poly?.enabled && (key === "str" || key === "dex" || key === "con");
    const useAging = systemData.traits?.applyAgingTable === true;
    const tableAging = useAging ? agingAdjustments(systemData.details?.ageCategory)[key] || 0 : 0;
    const agingPenalty = useAging ? -tableAging : Math.floor(Number(ability.aging) || 0);
    const racial = systemData.traits?.applyRacialAdjustments ? (this._racialAdjustment(systemData, key)) : 0;
    const penal =
      Math.floor(Number(ability.damage) || 0) +
      Math.floor(Number(ability.drain) || 0) +
      Math.floor(Number(ability.burn) || 0) +
      agingPenalty;
    if (usePoly) {
      const baseScore = Math.max(1, Math.floor(Number(poly[key]) || 10));
      return Math.max(1, baseScore + racial - penal);
    }
    const combined = (Number(ability.value) || 10) + (Number(ability.bonus) || 0) + racial;
    return Math.max(1, Math.floor(combined - penal));
  }

  _racialAdjustment(systemData, key) {
    const label = String(systemData.details?.race || "").trim().toLowerCase();
    if (!label) return 0;
    const match = Object.values(CTSDND35.races).find((race) => race.label.toLowerCase() === label);
    return Math.floor(Number(match?.abilities?.[key]) || 0);
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
  _prepareNpcData(_actorData, systemData) {
    const cr = systemData.details?.cr ?? systemData.details?.challengeRating;
    if (cr != null && cr !== "") systemData.details.xpAward = experienceForCr(cr);
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

    const loadedSpeed = (base) => {
      if (tier === "overload") return 5;
      if (tier === "medium" || tier === "heavy") return CTSDND35.speedFromLoadEncumbrance(base);
      return base;
    };
    const mode = (key) => {
      const base = Math.max(0, Number(systemData.attributes.speed[key].base) || 0);
      const effect = Math.floor(Number(systemData.attributes.speed[key].effectBonus) || 0);
      systemData.attributes.speed[key].total = paceSpeed(base, {
        armorPenalty: armorPen,
        encumberedSpeed: base > 0 ? loadedSpeed(base) : 0,
        effect,
      });
    };
    mode("fly");
    mode("swim");
    mode("climb");
    mode("burrow");

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
    let bestBab = 0;
    const classSave = { fort: 0, ref: 0, will: 0 };
    const bestSave = { fort: 0, ref: 0, will: 0 };
    let anyClassSave = false;
    const classItems = this.items.filter((i) => i.type === "class");
    for (const cls of classItems) {
      const level = Math.floor(Number(cls.system.level) || 0);
      const progression = resolveClassCombatProgression(cls.name, cls.system);
      const babTable = CTSDND35.babProgression[progression.bab] || CTSDND35.babProgression.med;
      if (level > 0) {
        const babValue = babTable[Math.min(level, 20) - 1] || 0;
        totalBAB += babValue;
        bestBab = Math.max(bestBab, babValue);
      }
      if (level <= 0) continue;
      for (const key of ["fort", "ref", "will"]) {
        const prog = progression.saves[key] === "high" ? "high" : "low";
        const table = CTSDND35.saveProgression[prog];
        const saveValue = table[Math.min(level, 20) - 1] || 0;
        classSave[key] += saveValue;
        bestSave[key] = Math.max(bestSave[key], saveValue);
        anyClassSave = true;
      }
    }
    if (systemData.details?.gestalt) {
      totalBAB = bestBab;
      for (const key of ["fort", "ref", "will"]) classSave[key] = bestSave[key];
    }
    const racialHd = Math.max(0, Math.floor(Number(systemData.details?.racialHd) || 0));
    if (racialHd) {
      const racialProg = systemData.details?.racialBab === "high" || systemData.details?.racialBab === "low" ? systemData.details.racialBab : "med";
      const racialTable = CTSDND35.babProgression[racialProg] || CTSDND35.babProgression.med;
      totalBAB += racialTable[Math.min(racialHd, 20) - 1] || 0;
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

    if (systemData.attributes.combat?.flatFooted && (systemData.attributes.ac.dexMode || "normal") === "normal") {
      systemData.attributes.ac.dexMode = "loseBonus";
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
      const synergy = synergyForSkill(key, systemData.skills);
      skill.synergy = synergy.bonus;
      const typed = skillTypedBonus(skill);
      skill.typedBonus = typed.total;
      const sizeHide = key === "hid" ? (CTSDND35.sizeMods[systemData.traits?.size || "med"] || CTSDND35.sizeMods.med).hide || 0 : 0;
      skill.sizeBonus = sizeHide;
      skill.untrainedBlocked = skillDef.untrained === false && Math.floor(Number(skill.ranks) || 0) < 1;
      skill.total =
        (skill.ranks || 0) +
        abilityMod +
        (skill.misc || 0) +
        synergy.bonus +
        typed.total +
        sizeHide +
        Math.floor(Number(skill.effectBonus) || 0) -
        armorEncPen -
        conditionPen -
        nl;
      const distracted = !!systemData.attributes.combat?.distracted;
      skill.take10 = distracted ? null : 10 + skill.total;
      skill.take20 = 20 + skill.total;
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
        preparation: preparationForClass(row.className || key, row.type),
        perDay,
      });
    }
    systemData.spellcasting.summary = summary;

    let clericLevel = 0;
    let paladinLevel = 0;
    for (const item of this.items) {
      if (item.type !== "class") continue;
      const name = String(item.name || "").toLowerCase();
      const level = Math.max(0, Math.floor(Number(item.system.level) || 0));
      if (name === "cleric" || name.startsWith("cleric ")) clericLevel += level;
      if (name === "paladin" || name.startsWith("paladin ")) paladinLevel += level;
    }
    const turning = turningProfile({
      clericLevel,
      paladinLevel,
      chaMod: systemData.abilities?.cha?.mod || 0,
      extraTurning: systemData.attributes.featProfile?.extraTurning || 0,
      expended: systemData.attributes.turning?.expended || 0,
    });
    systemData.attributes.turning = { ...systemData.attributes.turning, ...turning };
  }

  _prepareAttacksAndSpells(systemData) {
    const sizeKey = systemData.traits?.size || "med";
    const sizeMods = CTSDND35.sizeMods[sizeKey] || CTSDND35.sizeMods.med;
    const mods = {};
    for (const [key, ability] of Object.entries(systemData.abilities || {})) mods[key] = ability.mod || 0;
    const feats = systemData.attributes.featProfile || {};
    const round = systemData.attributes.round || {};
    const ctx = {
      bab: systemData.attributes.bab.total || 0,
      strMod: mods.str || 0,
      dexMod: mods.dex || 0,
      mods,
      sizeAttack: sizeMods.attack || 0,
      attackPenalty: systemData.attributes.attackRollPenalty || 0,
      damagePenalty: systemData.attributes.damageRollPenalty || 0,
      cannotAttack: !!systemData.attributes.conditionFlags?.cannotAttack,
      weaponFinesse: !!feats.weaponFinesse,
      flanking: !!round.flanking,
      higherGround: !!round.higherGround,
      pointBlank: !!round.pointBlank,
      rapidShot: !!round.rapidShot,
      powerAttack: round.powerAttack || 0,
      weaponFocus: feats.weaponFocus || [],
      greaterWeaponFocus: feats.greaterWeaponFocus || [],
      weaponSpec: feats.weaponSpec || [],
      greaterWeaponSpec: feats.greaterWeaponSpec || [],
      improvedCritical: feats.improvedCritical || [],
      manyshot: !!feats.manyshot && !!systemData.attributes.combat?.manyshot,
      sneakDice: sneakDiceForClasses(this.items),
      sneakAttack: !!systemData.attributes.combat?.sneakAttack,
      monkLevel: this.items.reduce((sum, item) => sum + (item.type === "class" && /^monk\b/i.test(item.name || "") ? Math.floor(Number(item.system?.level) || 0) : 0), 0),
      flurry: !!systemData.attributes.combat?.flurry,
      underwater: !!systemData.attributes.combat?.underwater,
      sizeKey,
      critImmune: critImmuneType(systemData.details?.creatureType) || !!systemData.attributes.critImmune,
      twf: resolveTwf(this.items, feats),
    };
    const summary = systemData.spellcasting.summary || [];
    for (const item of this.items) {
      if (item.type === "weapon" || item.type === "attack") {
        item.system.derived = buildWeaponDerived(item.system, { ...ctx, itemName: item.name });
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
