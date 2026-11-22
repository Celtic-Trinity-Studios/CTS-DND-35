/**
 * Round options, feat passives, two-weapon fighting, turning, and token senses.
 * Name matching is case-insensitive. Weapon Focus / Spell Focus use the feat's
 * Choice field, or the text in parentheses on the feat name.
 */

const FINESSE_WEAPONS = [
  "rapier", "dagger", "short sword", "kukri", "sai", "siangham", "spiked chain", "whip",
  "light mace", "punching dagger", "elven thinblade",
];

const LIGHT_WEAPONS = [
  "dagger", "kukri", "sai", "siangham", "short sword", "light mace", "handaxe", "throwing axe",
  "light hammer", "sickle", "spiked gauntlet", "punching dagger", "light pick", "sap", "nunchaku",
];

function parenChoice(name) {
  const match = String(name || "").match(/\(([^)]+)\)\s*$/);
  return match ? match[1].trim().toLowerCase() : "";
}

function featChoice(feat) {
  const selected = String(feat.system?.selection || "").trim().toLowerCase();
  return selected || parenChoice(feat.name);
}

function hasFeat(feats, pattern) {
  return feats.some((feat) => pattern.test(String(feat.name || "").trim()));
}

function choices(feats, pattern) {
  return feats.filter((feat) => pattern.test(String(feat.name || "").trim())).map(featChoice).filter(Boolean);
}

export function analyzeFeats(items = []) {
  const feats = [...items].filter((item) => item.type === "feat");
  return {
    improvedInitiative: hasFeat(feats, /^improved initiative$/i),
    greatFortitude: hasFeat(feats, /^great fortitude$/i),
    lightningReflexes: hasFeat(feats, /^lightning reflexes$/i),
    ironWill: hasFeat(feats, /^iron will$/i),
    dodge: hasFeat(feats, /^dodge$/i),
    toughness: feats.filter((feat) => /^toughness$/i.test(String(feat.name || "").trim())).length,
    combatCasting: hasFeat(feats, /^combat casting$/i),
    weaponFinesse: hasFeat(feats, /^weapon finesse$/i),
    powerAttack: hasFeat(feats, /^power attack$/i),
    combatExpertise: hasFeat(feats, /^combat expertise$/i),
    twf: hasFeat(feats, /^two-weapon fighting$/i),
    itwf: hasFeat(feats, /^improved two-weapon fighting$/i),
    gtwf: hasFeat(feats, /^greater two-weapon fighting$/i),
    combatReflexes: hasFeat(feats, /^combat reflexes$/i),
    rapidShot: hasFeat(feats, /^rapid shot$/i),
    spellPenetration: (hasFeat(feats, /^spell penetration$/i) ? 2 : 0) + (hasFeat(feats, /^greater spell penetration$/i) ? 2 : 0),
    extraTurning: feats.filter((feat) => /^extra turning$/i.test(String(feat.name || "").trim())).length,
    weaponFocus: choices(feats, /^weapon focus\b/i),
    greaterWeaponFocus: choices(feats, /^greater weapon focus\b/i),
    weaponSpec: choices(feats, /^weapon specialization\b/i),
    greaterWeaponSpec: choices(feats, /^greater weapon specialization\b/i),
    spellFocus: choices(feats, /^spell focus\b/i),
    greaterSpellFocus: choices(feats, /^greater spell focus\b/i),
  };
}

export function isLightWeapon(system = {}, name = "") {
  if (system.light === true || system.light === "true") return true;
  if (system.light === false || system.light === "false") return false;
  const label = String(name || "").toLowerCase();
  return LIGHT_WEAPONS.some((weapon) => label.includes(weapon));
}

export function isFinesseWeapon(system = {}, name = "") {
  if (system.finesse === true || system.finesse === "true") return true;
  const label = String(name || "").toLowerCase();
  return FINESSE_WEAPONS.some((weapon) => label.includes(weapon));
}

export function weaponChosen(name, selections = []) {
  const label = String(name || "").toLowerCase();
  return selections.some((choice) => choice && (label.includes(choice) || choice.includes(label)));
}

function flag(value) {
  return value === true || value === "true";
}

/**
 * @param {object} combat system.attributes.combat
 * @param {object} feats analyzeFeats result
 * @param {number} bab
 */
export function resolveRoundModifiers(combat = {}, feats = {}, bab = 0) {
  const notes = [];
  let attack = 0;
  let dodge = 0;
  let ac = 0;
  let cannotAttack = false;
  const posture = String(combat.posture || "normal");
  const babCap = Math.max(0, Math.floor(Number(bab) || 0));

  if (posture === "fightingDefensively") {
    attack -= 4;
    dodge += 2;
    notes.push("Fighting defensively: −4 attack, +2 dodge AC");
  } else if (posture === "totalDefense") {
    dodge += 4;
    cannotAttack = true;
    notes.push("Total defense: +4 dodge AC, no attacks");
  } else if (posture === "charge") {
    attack += 2;
    ac -= 2;
    notes.push("Charge: +2 attack, −2 AC");
  }

  let expertise = Math.max(0, Math.floor(Number(combat.combatExpertise) || 0));
  const maxExpertise = feats.combatExpertise ? Math.min(5, babCap) : 0;
  if (expertise > 0 && !feats.combatExpertise) notes.push("Combat Expertise ignored until the feat is on the sheet");
  expertise = Math.min(expertise, maxExpertise);
  attack -= expertise;
  dodge += expertise;
  if (expertise) notes.push(`Combat Expertise ${expertise}: −${expertise} attack, +${expertise} dodge`);

  let power = Math.max(0, Math.floor(Number(combat.powerAttack) || 0));
  const maxPower = feats.powerAttack ? babCap : 0;
  if (power > 0 && !feats.powerAttack) notes.push("Power Attack ignored until the feat is on the sheet");
  power = Math.min(power, maxPower);
  attack -= power;
  if (power) notes.push(`Power Attack ${power}: −${power} attack, +${power} damage (×2 two-handed)`);

  const coverSelf = String(combat.coverSelf || "none");
  if (coverSelf === "partial") {
    ac += 4;
    notes.push("You have cover: +4 AC");
  } else if (coverSelf === "improved") {
    ac += 8;
    notes.push("You have improved cover: +8 AC");
  }
  const coverTarget = String(combat.coverTarget || "none");
  if (coverTarget === "cover") {
    attack -= 4;
    notes.push("Target has cover: −4 attack");
  } else   if (coverTarget === "improved") {
    attack -= 8;
    notes.push("Target has improved cover: −8 attack");
  }
  if (flag(combat.rapidShot) && !feats.rapidShot) notes.push("Rapid Shot ignored until the feat is on the sheet");

  return {
    attack,
    dodge,
    ac,
    powerAttack: power,
    flanking: flag(combat.flanking),
    higherGround: flag(combat.higherGround),
    pointBlank: flag(combat.pointBlank),
    rapidShot: flag(combat.rapidShot) && !!feats.rapidShot,
    castDefensively: flag(combat.castDefensively),
    cannotAttack,
    notes,
  };
}

export function resolveTwf(items = [], feats = {}) {
  const offHands = [...items].filter((item) => item.type === "weapon" && flag(item.system?.offHand));
  if (!offHands.length) return null;
  const light = offHands.every((item) => isLightWeapon(item.system, item.name));
  let primary;
  let off;
  if (feats.twf) {
    primary = light ? 2 : 4;
    off = light ? 2 : 4;
  } else {
    primary = light ? 4 : 6;
    off = light ? 8 : 10;
  }
  const extra = feats.gtwf ? 2 : feats.itwf ? 1 : 0;
  return { primary, off, extra, light };
}

export function preparationForClass(className, type = "") {
  const name = String(className || "").trim().toLowerCase();
  if (["wizard", "cleric", "druid", "paladin", "ranger"].some((key) => name === key || name.startsWith(`${key} `))) return "prepared";
  if (["sorcerer", "bard"].some((key) => name === key || name.startsWith(`${key} `))) return "spontaneous";
  const kind = String(type || "").toLowerCase();
  if (kind.includes("spontaneous")) return "spontaneous";
  if (kind.includes("prepared")) return "prepared";
  return "";
}

export function metamagicProfile(spellSystem = {}) {
  const meta = spellSystem.metamagic || {};
  const heighten = Math.max(0, Math.floor(Number(meta.heighten) || 0));
  const empower = flag(meta.empower);
  const extend = flag(meta.extend);
  const still = flag(meta.still);
  const silent = flag(meta.silent);
  const quicken = flag(meta.quicken);
  const slotIncrease = heighten + (empower ? 2 : 0) + (extend ? 1 : 0) + (still ? 1 : 0) + (silent ? 1 : 0) + (quicken ? 4 : 0);
  return { heighten, empower, extend, still, silent, quicken, slotIncrease };
}

export function schoolBonus(school, feats = {}) {
  const label = String(school || "").toLowerCase();
  if (!label) return 0;
  let bonus = 0;
  if ((feats.spellFocus || []).some((choice) => label.includes(choice) || choice.includes(label))) bonus += 1;
  if ((feats.greaterSpellFocus || []).some((choice) => label.includes(choice) || choice.includes(label))) bonus += 1;
  return bonus;
}

export function creatureTypeNotes(creatureType = "") {
  const type = String(creatureType || "").toLowerCase();
  const notes = [];
  if (type.includes("undead")) {
    notes.push("Undead traits: immune to mind-affecting, poison, sleep, paralysis, stunning, disease, death effects, critical hits, nonlethal damage, ability drain and damage, fatigue, and energy drain.");
  }
  if (type.includes("construct")) {
    notes.push("Construct traits: immune to mind-affecting, poison, sleep, paralysis, stunning, disease, death effects, necromancy, critical hits, nonlethal damage, ability damage, fatigue, and energy drain.");
  }
  if (type.includes("plant")) notes.push("Plant traits: immune to mind-affecting, poison, sleep, paralysis, polymorph, and stunning.");
  if (type.includes("ooze")) notes.push("Ooze traits: immune to poison, sleep, paralysis, polymorph, stunning, critical hits, and flanking.");
  if (type.includes("elemental")) notes.push("Elemental traits: immune to poison, sleep, paralysis, stunning, critical hits, and flanking.");
  if (type.includes("vermin")) notes.push("Vermin traits: immune to mind-affecting effects.");
  return notes;
}

/**
 * Cleric turning level, plus paladin levels as a cleric three levels lower from 4th.
 */
export function turningProfile({ clericLevel = 0, paladinLevel = 0, chaMod = 0, extraTurning = 0, expended = 0 }) {
  const cleric = Math.max(0, Math.floor(Number(clericLevel) || 0));
  const paladin = Math.max(0, Math.floor(Number(paladinLevel) || 0));
  const paladinTurn = paladin >= 4 ? paladin - 3 : 0;
  const level = cleric + paladinTurn;
  const pool = level > 0 ? Math.max(0, 3 + Math.floor(Number(chaMod) || 0) + Math.floor(Number(extraTurning) || 0) * 4) : 0;
  const spent = Math.max(0, Math.floor(Number(expended) || 0));
  return { level, pool, spent, remaining: Math.max(0, pool - spent) };
}

export function visionFromSenses(senses = {}) {
  const dark = Math.max(0, Number(senses.darkvision) || 0);
  const blind = Math.max(0, Number(senses.blindsight) || Number(senses.blindsense) || 0);
  const range = Math.max(dark, blind);
  let visionMode = "basic";
  if (blind) visionMode = "blindsight";
  else if (dark) visionMode = "darkvision";
  const lowLight = senses.lowLightVision === true || senses.lowLightVision === "true";
  return { range, visionMode, enabled: range > 0 || lowLight, lowLight };
}
