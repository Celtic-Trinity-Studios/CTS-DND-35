/**
 * CTS DND 3.5 — System Configuration Constants
 */

export const CTSDND35 = {};

/**
 * Ability score definitions
 */
CTSDND35.abilities = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
};

CTSDND35.abilityAbbreviations = {
  str: "STR",
  dex: "DEX",
  con: "CON",
  int: "INT",
  wis: "WIS",
  cha: "CHA",
};

/**
 * Saving throw definitions
 */
CTSDND35.saves = {
  fort: "Fortitude",
  ref: "Reflex",
  will: "Will",
};

CTSDND35.saveAbbreviations = {
  fort: "FORT",
  ref: "REF",
  will: "WILL",
};

/**
 * Size categories
 */
CTSDND35.sizes = {
  fine: "Fine",
  dim: "Diminutive",
  tiny: "Tiny",
  sm: "Small",
  med: "Medium",
  lg: "Large",
  huge: "Huge",
  grg: "Gargantuan",
  col: "Colossal",
};

/**
 * Size modifiers for attack / AC / grapple / hide
 */
CTSDND35.sizeMods = {
  fine: { attack: 8, grapple: -16, hide: 16 },
  dim:  { attack: 4, grapple: -12, hide: 12 },
  tiny: { attack: 2, grapple: -8,  hide: 8  },
  sm:   { attack: 1, grapple: -4,  hide: 4  },
  med:  { attack: 0, grapple: 0,   hide: 0  },
  lg:   { attack: -1, grapple: 4,  hide: -4 },
  huge: { attack: -2, grapple: 8,  hide: -8 },
  grg:  { attack: -4, grapple: 12, hide: -12},
  col:  { attack: -8, grapple: 16, hide: -16},
};

/** Default melee reach (feet) when not overridden — PHB combat grid assumptions. */
CTSDND35.sizeReachFt = {
  fine: 0,
  dim: 0,
  tiny: 5,
  sm: 5,
  med: 5,
  lg: 10,
  huge: 15,
  grg: 20,
  col: 30,
};

/**
 * BAB progression tables
 */
CTSDND35.babProgression = {
  high: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
  med:  [0, 1, 2, 3, 3, 4, 5, 6, 6, 7,  8,  9,  9,  10, 11, 12, 12, 13, 14, 15],
  low:  [0, 1, 1, 2, 2, 3, 3, 4, 4, 5,  5,  6,  6,  7,  7,  8,  8,  9,  9,  10],
};

/**
 * Save progression tables
 */
CTSDND35.saveProgression = {
  high: [2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12],
  low:  [0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5,  5,  6,  6,  6 ],
};

/**
 * Weapon types
 */
CTSDND35.weaponTypes = {
  simple: "Simple",
  martial: "Martial",
  exotic: "Exotic",
  natural: "Natural",
};

/**
 * Armor types
 */
CTSDND35.armorTypes = {
  light: "Light",
  medium: "Medium",
  heavy: "Heavy",
  shield: "Shield",
};

/** Skills that take armor check penalty & load check penalty (SRD). Swim is doubled in code. */
CTSDND35.skillsArmorCheck = new Set(["bal", "clm", "esc", "hid", "jmp", "mov", "soh", "swm", "tmb"]);

/** Max Dex bonus to AC and check penalty magnitude by load (excluding armor); light = no extra limit. */
CTSDND35.loadEncumbranceEffects = {
  light: { maxDexBonus: Number.POSITIVE_INFINITY, checkPenalty: 0 },
  medium: { maxDexBonus: 3, checkPenalty: 3 },
  heavy: { maxDexBonus: 1, checkPenalty: 6 },
  overload: { maxDexBonus: 0, checkPenalty: 6 },
};

/**
 * Land speed from load encumbrance (SRD Table: Carrying Loads).
 * Medium and heavy load share the same movement column for a given base speed.
 * @param {number} baseFt
 * @returns {number}
 */
CTSDND35.speedFromLoadEncumbrance = function speedFromLoadEncumbrance(baseFt) {
  const b = Math.max(0, Math.floor(Number(baseFt) || 0));
  const table = [
    [15, 10],
    [20, 15],
    [30, 20],
    [40, 30],
    [50, 40],
    [60, 45],
    [70, 50],
    [80, 55],
    [90, 60],
    [100, 70],
  ];
  let enc = Math.max(5, Math.floor((b * 2) / 3));
  for (const [base, spd] of table) {
    if (b >= base) enc = spd;
  }
  return Math.max(5, enc);
};

/**
 * Spell schools
 */
CTSDND35.spellSchools = {
  abj: "Abjuration",
  con: "Conjuration",
  div: "Divination",
  enc: "Enchantment",
  evo: "Evocation",
  ill: "Illusion",
  nec: "Necromancy",
  trs: "Transmutation",
  uni: "Universal",
};

/**
 * Alignments
 */
CTSDND35.alignments = {
  lg: "Lawful Good",
  ng: "Neutral Good",
  cg: "Chaotic Good",
  ln: "Lawful Neutral",
  tn: "True Neutral",
  cn: "Chaotic Neutral",
  le: "Lawful Evil",
  ne: "Neutral Evil",
  ce: "Chaotic Evil",
};

/**
 * Actor Status tab — common conditions (3.5 SRD-style + familiar names).
 * Persisted as `system.details.status.conditions.<key>` (boolean).
 */
CTSDND35.statusConditions = [
  { key: "blinded", label: "Blinded" },
  { key: "charmed", label: "Charmed" },
  { key: "confused", label: "Confused" },
  { key: "cowering", label: "Cowering" },
  { key: "dazed", label: "Dazed" },
  { key: "dazzled", label: "Dazzled" },
  { key: "deafened", label: "Deafened" },
  { key: "disabled", label: "Disabled" },
  { key: "dying", label: "Dying" },
  { key: "entangled", label: "Entangled" },
  { key: "exhausted", label: "Exhausted" },
  { key: "fascinated", label: "Fascinated" },
  { key: "fatigued", label: "Fatigued" },
  { key: "frightened", label: "Frightened" },
  { key: "grappled", label: "Grappled" },
  { key: "helpless", label: "Helpless" },
  { key: "incorporeal", label: "Incorporeal" },
  { key: "invisible", label: "Invisible" },
  { key: "nauseated", label: "Nauseated" },
  { key: "panicked", label: "Panicked" },
  { key: "paralyzed", label: "Paralyzed" },
  { key: "petrified", label: "Petrified" },
  { key: "pinned", label: "Pinned" },
  { key: "prone", label: "Prone" },
  { key: "restrained", label: "Restrained" },
  { key: "shaken", label: "Shaken" },
  { key: "sickened", label: "Sickened" },
  { key: "slowed", label: "Slowed" },
  { key: "staggered", label: "Staggered" },
  { key: "stunned", label: "Stunned" },
  { key: "turned", label: "Turned" },
  { key: "unconscious", label: "Unconscious" },
];

/**
 * Standard 3.5e Races
 */
CTSDND35.races = {
  human: { label: "Human", size: "med", speed: 30, abilities: {} },
  dwarf: { label: "Dwarf", size: "med", speed: 20, abilities: { con: 2, cha: -2 } },
  elf: { label: "Elf", size: "med", speed: 30, abilities: { dex: 2, con: -2 } },
  gnome: { label: "Gnome", size: "sm", speed: 20, abilities: { con: 2, str: -2 } },
  halfElf: { label: "Half-Elf", size: "med", speed: 30, abilities: {} },
  halfOrc: { label: "Half-Orc", size: "med", speed: 30, abilities: { str: 2, int: -2, cha: -2 } },
  halfling: { label: "Halfling", size: "sm", speed: 20, abilities: { dex: 2, str: -2 } }
};

/**
 * D&D 3.5 Skill definitions
 * key: { label, ability, untrained }
 */
CTSDND35.skills = {
  apr: { label: "Appraise",              ability: "int", untrained: true  },
  bal: { label: "Balance",               ability: "dex", untrained: true  },
  blf: { label: "Bluff",                 ability: "cha", untrained: true  },
  clm: { label: "Climb",                 ability: "str", untrained: true  },
  con: { label: "Concentration",         ability: "con", untrained: true  },
  crf: { label: "Craft",                 ability: "int", untrained: true  },
  dcp: { label: "Decipher Script",       ability: "int", untrained: false },
  dip: { label: "Diplomacy",             ability: "cha", untrained: true  },
  dsb: { label: "Disable Device",        ability: "int", untrained: false },
  dis: { label: "Disguise",              ability: "cha", untrained: true  },
  esc: { label: "Escape Artist",         ability: "dex", untrained: true  },
  for: { label: "Forgery",               ability: "int", untrained: true  },
  gai: { label: "Gather Information",    ability: "cha", untrained: true  },
  han: { label: "Handle Animal",         ability: "cha", untrained: false },
  hea: { label: "Heal",                  ability: "wis", untrained: true  },
  hid: { label: "Hide",                  ability: "dex", untrained: true  },
  int: { label: "Intimidate",            ability: "cha", untrained: true  },
  jmp: { label: "Jump",                  ability: "str", untrained: true  },
  kar: { label: "Knowledge (Arcana)",    ability: "int", untrained: false },
  kdu: { label: "Knowledge (Dungeoneering)", ability: "int", untrained: false },
  ken: { label: "Knowledge (Engineering)", ability: "int", untrained: false },
  kge: { label: "Knowledge (Geography)", ability: "int", untrained: false },
  khi: { label: "Knowledge (History)",   ability: "int", untrained: false },
  klo: { label: "Knowledge (Local)",     ability: "int", untrained: false },
  kna: { label: "Knowledge (Nature)",    ability: "int", untrained: false },
  kno: { label: "Knowledge (Nobility)",  ability: "int", untrained: false },
  kpl: { label: "Knowledge (The Planes)", ability: "int", untrained: false },
  kre: { label: "Knowledge (Religion)",  ability: "int", untrained: false },
  lis: { label: "Listen",                ability: "wis", untrained: true  },
  mov: { label: "Move Silently",         ability: "dex", untrained: true  },
  opn: { label: "Open Lock",             ability: "dex", untrained: false },
  prf: { label: "Perform",               ability: "cha", untrained: true  },
  pro: { label: "Profession",            ability: "wis", untrained: false },
  rid: { label: "Ride",                  ability: "dex", untrained: true  },
  src: { label: "Search",                ability: "int", untrained: true  },
  sen: { label: "Sense Motive",          ability: "wis", untrained: true  },
  soh: { label: "Sleight of Hand",       ability: "dex", untrained: false },
  spc: { label: "Spellcraft",            ability: "int", untrained: false },
  spt: { label: "Spot",                  ability: "wis", untrained: true  },
  sur: { label: "Survival",              ability: "wis", untrained: true  },
  swm: { label: "Swim",                  ability: "str", untrained: true  },
  tmb: { label: "Tumble",                ability: "dex", untrained: false },
  umd: { label: "Use Magic Device",      ability: "cha", untrained: false },
  uro: { label: "Use Rope",              ability: "dex", untrained: true  },
};
