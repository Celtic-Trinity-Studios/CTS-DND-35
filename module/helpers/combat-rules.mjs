/**
 * D&D 3.5 combat, save, condition, and spellcasting helpers.
 * Pure functions so actor/item preparation and rolls share one path.
 */

import { expandedThreat, rangeIncrementPenalty } from "./open-rules.mjs";
import { isFinesseWeapon, metamagicProfile, schoolBonus, weaponChosen } from "./table-combat.mjs";

/** Core classes whose compendium rows were imported as BAB medium / all saves low. */
export const CORE_CLASS_PROGRESSION = {
  barbarian: { bab: "high", fort: "high", ref: "low", will: "low", ability: "" },
  bard: { bab: "med", fort: "low", ref: "high", will: "high", ability: "cha" },
  cleric: { bab: "med", fort: "high", ref: "low", will: "high", ability: "wis" },
  druid: { bab: "med", fort: "high", ref: "low", will: "high", ability: "wis" },
  fighter: { bab: "high", fort: "high", ref: "low", will: "low", ability: "" },
  monk: { bab: "med", fort: "high", ref: "high", will: "high", ability: "" },
  paladin: { bab: "high", fort: "high", ref: "low", will: "low", ability: "wis" },
  ranger: { bab: "high", fort: "high", ref: "high", will: "low", ability: "wis" },
  rogue: { bab: "med", fort: "low", ref: "high", will: "low", ability: "" },
  sorcerer: { bab: "low", fort: "low", ref: "low", will: "high", ability: "cha" },
  wizard: { bab: "low", fort: "low", ref: "low", will: "high", ability: "int" },
};

const ABILITY_KEYS = {
  str: "str",
  strength: "str",
  dex: "dex",
  dexterity: "dex",
  con: "con",
  constitution: "con",
  int: "int",
  intelligence: "int",
  wis: "wis",
  wisdom: "wis",
  cha: "cha",
  charisma: "cha",
};

export function slugifyClassKey(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function normalizeAbilityKey(raw) {
  const key = ABILITY_KEYS[String(raw || "").trim().toLowerCase()];
  return key || "";
}

/**
 * Use stored BAB/saves unless the item still has the compendium stub and the name is a core class.
 * @param {string} name
 * @param {object} system
 */
export function resolveClassCombatProgression(name, system = {}) {
  const storedBab = String(system.bab || "med").toLowerCase();
  const saves = system.saves || {};
  const fort = String(saves.fort || "low").toLowerCase();
  const ref = String(saves.ref || "low").toLowerCase();
  const will = String(saves.will || "low").toLowerCase();
  const stub = storedBab === "med" && fort === "low" && ref === "low" && will === "low";
  const core = CORE_CLASS_PROGRESSION[String(name || "").trim().toLowerCase()];
  if (stub && core) {
    return {
      bab: core.bab,
      saves: { fort: core.fort, ref: core.ref, will: core.will },
      ability: core.ability || "",
      fromCore: true,
    };
  }
  return {
    bab: storedBab === "high" || storedBab === "low" || storedBab === "med" ? storedBab : "med",
    saves: {
      fort: fort === "high" ? "high" : "low",
      ref: ref === "high" ? "high" : "low",
      will: will === "high" ? "high" : "low",
    },
    ability: normalizeAbilityKey(system.spellcasting?.ability) || core?.ability || "",
    fromCore: false,
  };
}

/**
 * Extra attacks at BAB−5, BAB−10, … while the result is +1 or higher.
 * @param {number} bab
 * @returns {number[]}
 */
export function iterativeAttackBonuses(bab) {
  const start = Math.floor(Number(bab) || 0);
  const bonuses = [start];
  let next = start - 5;
  while (next >= 1) {
    bonuses.push(next);
    next -= 5;
  }
  return bonuses;
}

/**
 * Bonus spells of a given level from a high ability score (PHB Table 1–1).
 * @param {number} score
 * @param {number} spellLevel 1–9
 */
export function bonusSpellsForScore(score, spellLevel) {
  const level = Math.floor(Number(spellLevel) || 0);
  if (level <= 0) return 0;
  const mod = Math.floor((Number(score) - 10) / 2);
  if (mod < level) return 0;
  return 1 + Math.floor((mod - level) / 4);
}

function on(conditions, key) {
  return conditions?.[key] === true;
}

/**
 * Numeric condition effects. Fear conditions do not stack with each other.
 * Exhausted replaces fatigued. Pinned includes grappled. Helpless replaces “lose Dex bonus”.
 * @param {object} conditions
 */
export function summarizeConditions(conditions = {}) {
  const notes = [];
  let strPen = 0;
  let dexPen = 0;
  let checkPenalty = 0;
  let attackExtra = 0;
  let damagePenalty = 0;
  let acPenalty = 0;
  let dexMode = "normal";
  let speedHalves = 0;
  let verbalFail = 0;
  let cannotAttack = false;
  let prone = false;

  if (on(conditions, "exhausted")) {
    strPen += 6;
    dexPen += 6;
    speedHalves += 1;
    notes.push("Exhausted: −6 Str and Dex, speed halved");
  } else if (on(conditions, "fatigued")) {
    strPen += 2;
    dexPen += 2;
    notes.push("Fatigued: −2 Str and Dex");
  }

  if (on(conditions, "grappled") || on(conditions, "pinned")) {
    dexPen += 4;
    notes.push("Grappled: −4 Dex");
  }
  if (on(conditions, "entangled")) {
    dexPen += 4;
    attackExtra += 2;
    speedHalves += 1;
    notes.push("Entangled: −2 attack, −4 Dex, speed halved");
  }

  if (on(conditions, "panicked") || on(conditions, "frightened") || on(conditions, "shaken")) {
    checkPenalty += 2;
    notes.push("Fear: −2 on attacks, saves, skills, and ability checks");
  }
  if (on(conditions, "sickened") && !on(conditions, "nauseated")) {
    checkPenalty += 2;
    damagePenalty += 2;
    notes.push("Sickened: −2 on attacks, weapon damage, saves, skills, and ability checks");
  }
  if (on(conditions, "dazzled")) {
    attackExtra += 1;
    notes.push("Dazzled: −1 on attacks");
  }

  if (on(conditions, "nauseated")) {
    cannotAttack = true;
    notes.push("Nauseated: only a move action");
  }
  if (on(conditions, "dazed")) {
    cannotAttack = true;
    notes.push("Dazed: no actions");
  }

  const helpless =
    on(conditions, "helpless") ||
    on(conditions, "unconscious") ||
    on(conditions, "paralyzed") ||
    on(conditions, "petrified");
  if (helpless) {
    dexMode = "helpless";
    cannotAttack = true;
    notes.push("Helpless: AC uses Dex 0 (−5)");
  } else if (on(conditions, "blinded") || on(conditions, "stunned") || on(conditions, "cowering")) {
    dexMode = "loseBonus";
    acPenalty += 2;
    notes.push("Loses Dexterity bonus to AC and takes −2 AC");
  }
  if (on(conditions, "stunned")) {
    cannotAttack = true;
    notes.push("Stunned: no actions");
  }
  if (on(conditions, "prone")) {
    prone = true;
    notes.push("Prone: −4 AC vs melee, +4 AC vs ranged");
  }
  if (on(conditions, "slowed")) {
    speedHalves += 1;
    notes.push("Slowed: land speed halved");
  }
  if (on(conditions, "deafened")) {
    verbalFail = 20;
    notes.push("Deafened: +20% failure on spells with verbal components");
  }
  if (on(conditions, "fascinated")) {
    cannotAttack = true;
    notes.push("Fascinated: no actions until the fascination ends");
  }
  if (on(conditions, "confused")) notes.push("Confused: roll 1d100 for the round's action");
  if (on(conditions, "dying") || on(conditions, "unconscious")) {
    cannotAttack = true;
    notes.push("Dying or unconscious: no actions");
  }
  if (on(conditions, "disabled") || on(conditions, "staggered")) {
    notes.push("Disabled or staggered: a single move or standard action, not both");
  }
  if (on(conditions, "invisible")) notes.push("Invisible: attackers without a way to see you miss half the time");
  if (on(conditions, "incorporeal")) notes.push("Incorporeal: 50% miss chance against nonmagical attacks");

  return {
    strPen,
    dexPen,
    checkPenalty,
    attackPenalty: checkPenalty + attackExtra,
    damagePenalty,
    acPenalty,
    dexMode,
    speedHalves,
    verbalFail,
    cannotAttack,
    prone,
    notes,
  };
}

function truthy(value) {
  return value === true || value === "true";
}

function damageFormulaFromItem(system) {
  if (typeof system.damageFormula === "string" && system.damageFormula.trim()) return system.damageFormula.trim();
  if (Array.isArray(system.damage?.parts) && system.damage.parts.length) {
    const parts = system.damage.parts.map((part) => String(part?.[0] || "").trim()).filter(Boolean);
    if (parts.length) return parts.join(" + ");
  }
  if (typeof system.damage === "string" && system.damage.trim()) return system.damage.trim();
  return "";
}

/**
 * @param {object} system weapon or attack item system
 * @param {object} ctx actor attack context
 */
export function buildWeaponDerived(system = {}, ctx = {}) {
  const subtype = String(system.weaponSubtype || system.attackType || system.actionType || "melee").toLowerCase();
  const ranged = subtype.includes("ranged") || subtype === "rwak" || subtype === "rtouch";
  const finesse = truthy(system.finesse) || (!!ctx.weaponFinesse && isFinesseWeapon(system, ctx.itemName));
  const twoHanded = truthy(system.twoHanded);
  const offHand = truthy(system.offHand);
  const thrown = truthy(system.thrown) || subtype.includes("thrown");
  const natural = system.weaponType === "natural" || truthy(system.natural);
  const secondary = truthy(system.secondary);
  const proficient = system.proficient !== false && system.proficient !== "false";

  const mods = ctx.mods || {};
  const override = normalizeAbilityKey(system.ability);
  let atkAbility = ranged ? Number(ctx.dexMod) || 0 : Number(ctx.strMod) || 0;
  if (!ranged && finesse && (Number(ctx.dexMod) || 0) > atkAbility) atkAbility = Number(ctx.dexMod) || 0;
  if (override && mods[override] != null) atkAbility = Number(mods[override]) || 0;

  const enhancement = Math.floor(Number(system.enhancement) || 0);
  const misc = Math.floor(Number(system.attackMisc ?? (typeof system.attackBonus === "number" ? system.attackBonus : 0)) || 0);
  const bab = Math.floor(Number(ctx.bab) || 0);
  const sizeAttack = Math.floor(Number(ctx.sizeAttack) || 0);
  const attackPenalty = Math.floor(Number(ctx.attackPenalty) || 0);
  const nonprof = proficient ? 0 : 4;
  const full = bab + atkAbility + sizeAttack + enhancement + misc - attackPenalty - nonprof;

  let attackBonuses;
  if (natural) attackBonuses = [secondary ? full - 5 : full];
  else if (offHand) attackBonuses = [full];
  else attackBonuses = iterativeAttackBonuses(bab).map((iter) => full - bab + iter);

  const str = Number(ctx.strMod) || 0;
  let damageAbility = 0;
  if (!ranged || thrown) {
    if (offHand || secondary) damageAbility = str > 0 ? Math.floor(str / 2) : str;
    else if (twoHanded) damageAbility = str > 0 ? Math.floor(str * 1.5) : str;
    else damageAbility = str;
  }
  damageAbility += enhancement;
  damageAbility -= Math.floor(Number(ctx.damagePenalty) || 0);

  const notes = [];
  let situational = Math.floor(Number(ctx.situationalAttack) || 0);
  if (!ranged && ctx.flanking) {
    situational += 2;
    notes.push("Flanking +2");
  }
  if (!ranged && ctx.higherGround) {
    situational += 2;
    notes.push("Higher ground +2");
  }
  if (ranged && ctx.pointBlank) {
    situational += 1;
    damageAbility += 1;
    notes.push("Point Blank Shot +1");
  }
  if (weaponChosen(ctx.itemName, ctx.weaponFocus)) {
    situational += 1;
    notes.push("Weapon Focus +1");
  }
  if (weaponChosen(ctx.itemName, ctx.greaterWeaponFocus)) {
    situational += 1;
    notes.push("Greater Weapon Focus +1");
  }
  if (weaponChosen(ctx.itemName, ctx.weaponSpec)) {
    damageAbility += 2;
    notes.push("Weapon Specialization +2");
  }
  if (weaponChosen(ctx.itemName, ctx.greaterWeaponSpec)) {
    damageAbility += 2;
    notes.push("Greater Weapon Specialization +2");
  }
  const power = !ranged ? Math.max(0, Math.floor(Number(ctx.powerAttack) || 0)) : 0;
  if (power) {
    damageAbility += twoHanded ? power * 2 : power;
    notes.push(`Power Attack damage +${twoHanded ? power * 2 : power}`);
  }

  if (ctx.twf && !natural) {
    if (offHand) {
      const base = full - ctx.twf.off + situational;
      attackBonuses = [base];
      if (ctx.twf.extra >= 1) attackBonuses.push(base - 5);
      if (ctx.twf.extra >= 2) attackBonuses.push(base - 10);
      notes.push(`Off-hand −${ctx.twf.off}`);
    } else if (!secondary) {
      attackBonuses = attackBonuses.map((bonus) => bonus - ctx.twf.primary + situational);
      notes.push(`Two-weapon fighting −${ctx.twf.primary}`);
    } else {
      attackBonuses = attackBonuses.map((bonus) => bonus + situational);
    }
  } else {
    attackBonuses = attackBonuses.map((bonus) => bonus + situational);
  }

  if (ctx.rapidShot && ranged && !natural && !offHand) {
    attackBonuses = attackBonuses.map((bonus) => bonus - 2);
    attackBonuses.unshift(attackBonuses[0]);
    notes.push("Rapid Shot −2, extra attack");
  }
  if (ranged && ctx.manyshot) {
    notes.push("Manyshot: extra arrows use this attack roll and their own damage");
  }

  const increments = Math.max(1, Math.floor(Number(system.rangeIncrements) || 1));
  if (ranged && increments > 1) {
    const rangePen = rangeIncrementPenalty(increments);
    attackBonuses = attackBonuses.map((bonus) => bonus - rangePen);
    notes.push(`Range increment ${increments}: −${rangePen}`);
  }

  const sneakDice = Math.max(0, Math.floor(Number(ctx.sneakDice) || 0));
  const baseFormula = damageFormulaFromItem(system);
  let damageFormula = baseFormula;
  if (damageAbility) damageFormula = baseFormula ? `${baseFormula} + ${damageAbility}` : String(damageAbility);
  if (!damageFormula) damageFormula = "0";
  const sneakNow = ctx.sneakAttack && sneakDice && (!ranged || ctx.pointBlank);
  if (sneakNow) damageFormula = `${damageFormula} + ${sneakDice}d6`;

  const threatSource = system.critRange != null && system.critRange !== "" ? system.critRange : system.critical?.range;
  const multiplierSource = system.critMultiplier != null && system.critMultiplier !== "" ? system.critMultiplier : system.critical?.multiplier;
  const rawThreat = Math.min(20, Math.max(1, Math.floor(Number(threatSource) || 20)));
  let critDoubles = 0;
  const keen = truthy(system.keen) || String(ctx.itemName || "").toLowerCase().includes("keen");
  if (keen) critDoubles += 1;
  if (weaponChosen(ctx.itemName, ctx.improvedCritical)) critDoubles += 1;
  const threat = expandedThreat(rawThreat, critDoubles);
  if (critDoubles) notes.push(`Threat ${threat}–20`);
  const multiplier = Math.max(2, Math.floor(Number(multiplierSource) || 2));
  if (ctx.sneakAttack && sneakDice && !ranged) {
    notes.push(`Sneak attack +${sneakDice}d6`);
  } else if (ctx.sneakAttack && sneakDice && ranged && ctx.pointBlank) {
    notes.push(`Sneak attack +${sneakDice}d6 (point-blank)`);
  }
  const damageType = String(system.damageType || system.damage?.parts?.[0]?.[1] || "");
  const attackLabel = attackBonuses.map((n) => (n >= 0 ? `+${n}` : `${n}`)).join("/");

  return {
    attackBonuses,
    attackLabel,
    damageFormula,
    damageType,
    threat,
    multiplier,
    magic: enhancement > 0 || truthy(system.magic),
    material: String(system.material || "").toLowerCase(),
    alignment: String(system.alignment || system.weaponAlignment || "").toLowerCase(),
    nonlethal: truthy(system.nonlethal),
    cannotAttack: !!ctx.cannotAttack,
    proficient,
    notes,
  };
}

export function inferSaveAbility(system = {}) {
  const explicit = String(system.save?.ability || system.saveAbility || "").toLowerCase();
  if (explicit.startsWith("fort")) return "fort";
  if (explicit.startsWith("ref")) return "ref";
  if (explicit.startsWith("will")) return "will";
  const plain = String(system.description || "").replace(/<[^>]+>/g, " ");
  const match = plain.match(/Saving Throw:\s*([^\n]+)/i);
  const blob = String(match?.[1] || "").toLowerCase();
  if (!blob || blob.includes("none")) return "";
  if (blob.includes("fort")) return "fort";
  if (blob.includes("ref")) return "ref";
  if (blob.includes("will")) return "will";
  return "";
}

/**
 * @param {object} spellSystem
 * @param {object[]} summary spellcasting.summary rows
 * @param {object} actorSystem
 */
export function buildSpellDerived(spellSystem = {}, summary = [], actorSystem = {}) {
  const level = Math.max(0, Math.floor(Number(spellSystem.spellLevel) || 0));
  const want = String(spellSystem.casterClass || "").trim().toLowerCase();
  let caster = null;
  if (want) {
    caster = summary.find((row) => row.key === want || String(row.className || "").toLowerCase() === want) || null;
  }
  if (!caster) {
    const slotTotal = (row) => {
      const slots = Array.isArray(row.perDay) ? row.perDay : [];
      const hit = slots.find((slot) => Number(slot?.level) === level);
      return Number(hit?.total) || 0;
    };
    const capable = summary.filter((row) => slotTotal(row) > 0);
    caster = capable.sort((a, b) => (b.casterLevel || 0) - (a.casterLevel || 0))[0] || summary[0] || null;
  }
  const abilityMod = Number(caster?.abilityMod) || 0;
  const meta = metamagicProfile(spellSystem);
  const dcLevel = level + meta.heighten;
  const focus = schoolBonus(spellSystem.school, actorSystem.attributes?.featProfile);
  const computedDc = 10 + dcLevel + abilityMod + focus;
  const override = spellSystem.save?.dc;
  const dc = override != null && override !== "" && Number.isFinite(Number(override)) ? Math.floor(Number(override)) : computedDc;
  const saveAbility = inferSaveAbility(spellSystem);
  const arcane = String(caster?.type || "").toLowerCase().includes("arcane");
  const verbal = spellSystem.components?.verbal !== false && !meta.silent;
  const somatic = spellSystem.components?.somatic !== false && !meta.still;
  const armorAsf = arcane && somatic ? Math.max(0, Math.floor(Number(actorSystem.spellcasting?.arcaneSpellFailureTotal) || 0)) : 0;
  const deaf = verbal ? Math.max(0, Math.floor(Number(actorSystem.attributes?.conditionFlags?.verbalFail) || 0)) : 0;
  const failureChance = Math.min(100, armorAsf + deaf);
  const preparedRaw = spellSystem.prepared;
  const prepared = preparedRaw === true || preparedRaw === "true" ? 1 : Math.max(0, Math.floor(Number(preparedRaw) || 0));
  return {
    dc: caster || (override != null && override !== "") ? dc : null,
    casterLevel: Number(caster?.casterLevel) || 0,
    className: caster?.className || "",
    classKey: caster?.key || "",
    ability: caster?.ability || "",
    saveAbility,
    failureChance,
    arcane,
    slotLevel: level + meta.slotIncrease,
    prepared,
    preparation: caster?.preparation || "",
    spellPenetration: Math.floor(Number(actorSystem.attributes?.featProfile?.spellPenetration) || 0),
    empower: meta.empower,
    concentrationDc: 15 + level + meta.slotIncrease,
    halfOnSave: truthy(spellSystem.save?.half) || /half damage/i.test(String(spellSystem.description || "")),
  };
}

const ENERGY_KEYS = ["fire", "cold", "acid", "electricity", "sonic"];

/**
 * @param {number} amount
 * @param {string} damageType
 * @param {object} energy
 */
export function applyEnergyToDamage(amount, damageType, energy = {}) {
  const type = String(damageType || "").toLowerCase();
  const hit = ENERGY_KEYS.find((key) => type.includes(key));
  if (!hit) return { amount, note: "" };
  if (energy.immune?.[hit]) return { amount: 0, note: `Immune to ${hit}` };
  const resist = Math.max(0, Math.floor(Number(energy.resist?.[hit]) || 0));
  if (!resist) return { amount, note: "" };
  return { amount: Math.max(0, amount - resist), note: `${hit} resistance ${resist}` };
}
