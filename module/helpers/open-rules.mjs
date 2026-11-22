/**
 * Rules that were still manual after the combat and skill passes.
 * Pure functions so they can be checked without Foundry.
 */

/** XP required to reach this character level (PHB Table 3–2). Level 1 is 0. */
const XP_FOR_LEVEL = [
  0, 1000, 3000, 6000, 10000, 15000, 21000, 28000, 36000, 45000,
  55000, 66000, 78000, 91000, 105000, 120000, 136000, 153000, 171000, 190000,
];

/** Psion and wilder power-point base by level (Expanded Psionics Handbook), before the ability bonus. */
const PSION_PP = [2, 6, 11, 17, 25, 35, 46, 58, 72, 88, 106, 126, 147, 170, 195, 221, 250, 280, 311, 343];
/** Psychic warrior power-point base by level. */
const WARRIOR_PP = [0, 1, 3, 5, 7, 11, 15, 19, 23, 27, 35, 43, 51, 59, 67, 79, 91, 103, 115, 127];

/** 5 ranks in the key skill grants these bonuses. */
const SYNERGY = {
  blf: [["dip", 2], ["int", 2], ["soh", 2]],
  esc: [["uro", 2]],
  han: [["rid", 2]],
  jmp: [["tmb", 2]],
  kar: [["spc", 2]],
  kna: [["sur", 2]],
  src: [["sur", 2]],
  sen: [["dip", 2]],
  spc: [["umd", 2]],
  sur: [["kna", 2]],
  tmb: [["bal", 2], ["jmp", 2]],
  uro: [["clm", 2], ["esc", 2]],
};

const AGING = {
  middle: { str: -1, dex: -1, con: -1, int: 1, wis: 1, cha: 1 },
  old: { str: -2, dex: -2, con: -2, int: 1, wis: 1, cha: 1 },
  venerable: { str: -3, dex: -3, con: -3, int: 1, wis: 1, cha: 1 },
};

const SLOT_CAPS = {
  head: 1, eyes: 1, neck: 1, shoulders: 1, body: 1, torso: 1, armor: 1,
  waist: 1, arms: 1, hands: 1, ring: 2, feet: 1,
};

export function xpRequiredForLevel(level) {
  const n = Math.floor(Number(level) || 1);
  if (n <= 1) return 0;
  if (n > 20) return XP_FOR_LEVEL[19] + (n - 20) * 20000;
  return XP_FOR_LEVEL[n - 1];
}

export function xpToReachNextLevel(currentLevel) {
  return xpRequiredForLevel(Math.floor(Number(currentLevel) || 1) + 1);
}

/**
 * PHB Table 3–6. −20% for each class more than one level behind the highest,
 * after setting aside one favored class.
 * @param {{name: string, level: number}[]} classes
 * @param {string} favored
 */
export function multiclassXpPenalty(classes, favored = "") {
  const live = (classes || []).filter((row) => Math.floor(Number(row.level) || 0) > 0);
  if (live.length < 2) return { percent: 0, counted: [] };
  const highest = Math.max(...live.map((row) => Math.floor(row.level)));
  const fav = String(favored || "").trim().toLowerCase();
  let skipped = false;
  const counted = [];
  for (const row of live) {
    const name = String(row.name || "");
    const label = name.toLowerCase();
    const isFavored = fav && (label === fav || label.includes(fav) || fav.includes(label));
    if (isFavored && !skipped) {
      skipped = true;
      continue;
    }
    if (highest - Math.floor(row.level) > 1) counted.push(name);
  }
  return { percent: counted.length * 20, counted };
}

export function synergyForSkill(skillKey, skills = {}) {
  let bonus = 0;
  const from = [];
  for (const [source, grants] of Object.entries(SYNERGY)) {
    const ranks = Math.floor(Number(skills[source]?.ranks) || 0);
    if (ranks < 5) continue;
    for (const [target, amount] of grants) {
      if (target !== skillKey) continue;
      bonus += amount;
      from.push(source);
    }
  }
  return { bonus, from };
}

/** Threat number after Keen and Improved Critical. Each doubles the original width, and they stack. */
export function expandedThreat(baseThreat, doublings = 0) {
  const start = Math.min(20, Math.max(1, Math.floor(Number(baseThreat) || 20)));
  const times = Math.max(0, Math.floor(Number(doublings) || 0));
  const width = Math.max(1, 21 - start) * (2 ** times);
  return Math.max(1, 21 - width);
}

/** −2 per range increment after the first. `increments` is how many increments away the target is. */
export function rangeIncrementPenalty(increments) {
  const n = Math.max(1, Math.floor(Number(increments) || 1));
  return (n - 1) * 2;
}

export function sneakDiceForClasses(items = []) {
  let dice = 0;
  for (const item of items) {
    if (item.type !== "class") continue;
    const name = String(item.name || "").trim().toLowerCase();
    const level = Math.max(0, Math.floor(Number(item.system?.level) || 0));
    if (!level) continue;
    if (name === "rogue" || name.startsWith("rogue ")) dice += Math.ceil(level / 2);
  }
  return dice;
}

/**
 * Highest DR that this attack does not bypass. Rows do not stack.
 * @param {number} amount
 * @param {{magic?: boolean, material?: string, alignment?: string, dr?: {amount?: number, bypass?: string}[]}} attack
 */
export function applyDamageReduction(amount, attack = {}) {
  const rows = Array.isArray(attack.dr) ? attack.dr : [];
  const material = String(attack.material || "").toLowerCase();
  const alignment = String(attack.alignment || "").toLowerCase();
  let best = 0;
  let bypassLabel = "";
  for (const row of rows) {
    const dr = Math.max(0, Math.floor(Number(row?.amount) || 0));
    if (!dr) continue;
    const bypass = String(row?.bypass || "").trim().toLowerCase();
    const magicHit = !!attack.magic && bypass.includes("magic");
    const materialHit = !!material && bypass.includes(material);
    const alignmentHit = !!alignment && bypass.includes(alignment);
    if (bypass && bypass !== "-" && bypass !== "—" && bypass !== "none" && (magicHit || materialHit || alignmentHit)) continue;
    if (dr > best) {
      best = dr;
      bypassLabel = row.bypass || "—";
    }
  }
  return { amount: Math.max(0, Math.floor(Number(amount) || 0) - best), applied: best, bypass: bypassLabel };
}

export function paceSpeed(base, { armorPenalty = 0, encumberedSpeed = null, effect = 0, difficult = false } = {}) {
  const start = Math.max(0, Math.floor(Number(base) || 0));
  if (!start) return 0;
  const afterArmor = Math.max(5, start - Math.max(0, Math.floor(Number(armorPenalty) || 0)));
  const loaded = encumberedSpeed == null ? start : Math.max(5, Math.floor(Number(encumberedSpeed) || 0));
  let speed = Math.max(5, Math.min(afterArmor, loaded));
  if (difficult) speed = Math.max(5, Math.floor(speed / 2));
  speed += Math.floor(Number(effect) || 0);
  return Math.max(0, speed);
}

export function fallingDamageDice(feet) {
  const distance = Math.max(0, Math.floor(Number(feet) || 0));
  return Math.min(20, Math.floor(distance / 10));
}

export function breathWeaponDc(hitDice, conMod = 0) {
  return 10 + Math.floor(Math.max(0, Number(hitDice) || 0) / 2) + Math.floor(Number(conMod) || 0);
}

export function massiveDamageDc() {
  return 15;
}

export function halfDamage(amount, saved) {
  const n = Math.max(0, Math.floor(Number(amount) || 0));
  return saved ? Math.floor(n / 2) : n;
}

export function sellAtHalf(priceGp) {
  return Math.floor(Math.max(0, Number(priceGp) || 0) * 2) / 4;
}

/** DMG experience for one creature of this CR. Fractional CR uses the matching row. */
const CR_XP = {
  "1/10": 25, "1/8": 25, "1/6": 50, "1/4": 75, "1/3": 100, "1/2": 150,
  1: 300, 2: 600, 3: 900, 4: 1200, 5: 1500, 6: 1800, 7: 2100, 8: 2400, 9: 2700, 10: 3000,
  11: 3300, 12: 3600, 13: 3900, 14: 4200, 15: 4500, 16: 4800, 17: 5100, 18: 5400, 19: 5700, 20: 6000,
};

export function experienceForCr(cr) {
  const key = String(cr ?? "").trim();
  if (CR_XP[key] != null) return CR_XP[key];
  const n = Math.floor(Number(key));
  if (n >= 1 && n <= 20) return CR_XP[n];
  if (n > 20) return 6000 + (n - 20) * 300;
  return 0;
}

export function psionPowerPoints(level, abilityMod = 0, kind = "psion") {
  const n = Math.floor(Number(level) || 0);
  if (n <= 0) return 0;
  const table = /warrior/i.test(String(kind)) ? WARRIOR_PP : PSION_PP;
  const base = table[Math.min(n, 20) - 1];
  const mod = Math.floor(Number(abilityMod) || 0);
  const bonus = mod > 0 ? Math.floor((mod * n) / 2) : 0;
  return base + bonus;
}

export function agingAdjustments(category) {
  return { ...(AGING[String(category || "").toLowerCase()] || {}) };
}

export function slotLoad(items = []) {
  const used = {};
  for (const item of items) {
    const equipped = item.system?.equipped === true || item.system?.equipped === "true";
    const slot = String(item.system?.slot || "").trim().toLowerCase();
    if (!equipped || !slot) continue;
    used[slot] = (used[slot] || 0) + 1;
  }
  const overflow = [];
  for (const [slot, count] of Object.entries(used)) {
    const cap = SLOT_CAPS[slot] ?? 1;
    if (count > cap) overflow.push({ slot, count, cap });
  }
  return { used, overflow };
}

export function classFeatureList(classes, getGrants) {
  const rows = [];
  for (const item of classes || []) {
    const level = Math.floor(Number(item.system?.level) || 0);
    if (level <= 0 || typeof getGrants !== "function") continue;
    for (const grant of getGrants(item.system, 0, level)) {
      rows.push({ className: item.name, ...grant });
    }
  }
  return rows;
}
