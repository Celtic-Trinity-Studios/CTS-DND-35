/**
 * CTS DND 35 — System Configuration Constants
 */

export const CTSDND35 = {};

/**
 * Ability score definitions
 */
CTSDND35.abilities = {
  str: "CTSDND35.AbilityStr",
  dex: "CTSDND35.AbilityDex",
  con: "CTSDND35.AbilityCon",
  int: "CTSDND35.AbilityInt",
  wis: "CTSDND35.AbilityWis",
  cha: "CTSDND35.AbilityCha",
};

CTSDND35.abilityAbbreviations = {
  str: "CTSDND35.AbilityStrAbbr",
  dex: "CTSDND35.AbilityDexAbbr",
  con: "CTSDND35.AbilityConAbbr",
  int: "CTSDND35.AbilityIntAbbr",
  wis: "CTSDND35.AbilityWisAbbr",
  cha: "CTSDND35.AbilityChaAbbr",
};

/**
 * Saving throw definitions
 */
CTSDND35.saves = {
  fort: "CTSDND35.SaveFort",
  ref: "CTSDND35.SaveRef",
  will: "CTSDND35.SaveWill",
};

CTSDND35.saveAbbreviations = {
  fort: "CTSDND35.SaveFortAbbr",
  ref: "CTSDND35.SaveRefAbbr",
  will: "CTSDND35.SaveWillAbbr",
};

/**
 * Size categories
 */
CTSDND35.sizes = {
  fine: "CTSDND35.SizeFine",
  dim: "CTSDND35.SizeDiminutive",
  tiny: "CTSDND35.SizeTiny",
  sm: "CTSDND35.sizesmall",
  med: "CTSDND35.SizeMedium",
  lg: "CTSDND35.SizeLarge",
  huge: "CTSDND35.SizeHuge",
  grg: "CTSDND35.SizeGargantuan",
  col: "CTSDND35.SizeColossal",
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
