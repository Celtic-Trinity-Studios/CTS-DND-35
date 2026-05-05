/**
 * D&D 3.5 carrying capacity (Medium biped), per SRD Table: Carrying Capacity.
 * Str 30+ uses Tremendous Strength rule (same ones digit row × 4 per +10).
 */

/** @type {{ lightMax: number; mediumMax: number; heavyMax: number }[]} Index = Str − 1 for Str 1–29 */
export const CARRYING_CAPACITY_MEDIUM_BIPED = [
  { lightMax: 3, mediumMax: 6, heavyMax: 10 },
  { lightMax: 6, mediumMax: 13, heavyMax: 20 },
  { lightMax: 10, mediumMax: 20, heavyMax: 30 },
  { lightMax: 13, mediumMax: 26, heavyMax: 40 },
  { lightMax: 16, mediumMax: 33, heavyMax: 50 },
  { lightMax: 20, mediumMax: 40, heavyMax: 60 },
  { lightMax: 23, mediumMax: 46, heavyMax: 70 },
  { lightMax: 26, mediumMax: 53, heavyMax: 80 },
  { lightMax: 30, mediumMax: 60, heavyMax: 90 },
  { lightMax: 33, mediumMax: 66, heavyMax: 100 },
  { lightMax: 38, mediumMax: 76, heavyMax: 115 },
  { lightMax: 43, mediumMax: 86, heavyMax: 130 },
  { lightMax: 50, mediumMax: 100, heavyMax: 150 },
  { lightMax: 58, mediumMax: 116, heavyMax: 175 },
  { lightMax: 66, mediumMax: 133, heavyMax: 200 },
  { lightMax: 76, mediumMax: 153, heavyMax: 230 },
  { lightMax: 86, mediumMax: 173, heavyMax: 260 },
  { lightMax: 100, mediumMax: 200, heavyMax: 300 },
  { lightMax: 116, mediumMax: 233, heavyMax: 350 },
  { lightMax: 133, mediumMax: 266, heavyMax: 400 },
  { lightMax: 153, mediumMax: 306, heavyMax: 460 },
  { lightMax: 173, mediumMax: 346, heavyMax: 520 },
  { lightMax: 200, mediumMax: 400, heavyMax: 600 },
  { lightMax: 233, mediumMax: 466, heavyMax: 700 },
  { lightMax: 266, mediumMax: 533, heavyMax: 800 },
  { lightMax: 306, mediumMax: 613, heavyMax: 920 },
  { lightMax: 346, mediumMax: 693, heavyMax: 1040 },
  { lightMax: 400, mediumMax: 800, heavyMax: 1200 },
  { lightMax: 466, mediumMax: 933, heavyMax: 1400 },
];

/**
 * @param {number} str
 * @returns {{ lightMax: number; mediumMax: number; heavyMax: number }}
 */
export function getCarryingLimitsForStrength(str) {
  const s = Math.max(1, Math.floor(Number(str) || 1));
  if (s <= 29) return CARRYING_CAPACITY_MEDIUM_BIPED[s - 1];

  const ones = s % 10;
  const baseStr = 20 + ones;
  const idx = Math.min(Math.max(baseStr, 20), 29) - 1;
  const base = CARRYING_CAPACITY_MEDIUM_BIPED[idx];
  const factor = 4 ** Math.floor((s - baseStr) / 10);
  return {
    lightMax: base.lightMax * factor,
    mediumMax: base.mediumMax * factor,
    heavyMax: base.heavyMax * factor,
  };
}

/** Bipedal carrying multiplier by size (SRD “Bigger and Smaller Creatures”). */
export const BIPED_CARRYING_SIZE_MULT = {
  fine: 1 / 8,
  dim: 1 / 4,
  tiny: 1 / 2,
  sm: 3 / 4,
  med: 1,
  lg: 2,
  huge: 4,
  grg: 8,
  col: 16,
};

/**
 * @param {number} str
 * @param {string} sizeKey traits.size
 */
export function getAdjustedCarryingLimits(str, sizeKey) {
  const mult = BIPED_CARRYING_SIZE_MULT[sizeKey] ?? BIPED_CARRYING_SIZE_MULT.med;
  const base = getCarryingLimitsForStrength(str);
  const scale = (n) => Math.max(1, Math.floor(n * mult));
  return {
    lightMax: scale(base.lightMax),
    mediumMax: scale(base.mediumMax),
    heavyMax: scale(base.heavyMax),
  };
}

/**
 * @param {number} weightLb
 * @param {{ lightMax: number; mediumMax: number; heavyMax: number }} limits
 * @returns {"light"|"medium"|"heavy"|"overload"}
 */
export function getLoadBandFromWeight(weightLb, limits) {
  const w = Math.max(0, Number(weightLb) || 0);
  if (w <= limits.lightMax) return "light";
  if (w <= limits.mediumMax) return "medium";
  if (w <= limits.heavyMax) return "heavy";
  return "overload";
}
