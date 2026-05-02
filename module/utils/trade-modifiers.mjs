/**
 * Gear price modifiers when `buyer` purchases from `seller`.
 * Uses buyer.system.details.factionAffiliations[].gearPct (stacking %)
 * and buyer.system.details.raceTradeMods when seller.system.details.race matches (case-insensitive normalized).
 */

export function normalizeRaceLabel(s) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * Total percent adjustment (e.g. −10 and +5 → −5).
 * Counts: buyer faction rows; buyer race rows vs seller race; seller race rows vs buyer race.
 */
export function computeGearPricePercentTotal(buyer, seller) {
  let pct = 0;
  for (const row of buyer?.system?.details?.factionAffiliations ?? []) {
    pct += Number(row?.gearPct) || 0;
  }
  const sellerRace = normalizeRaceLabel(seller?.system?.details?.race);
  const buyerRace = normalizeRaceLabel(buyer?.system?.details?.race);
  for (const row of buyer?.system?.details?.raceTradeMods ?? []) {
    if (sellerRace && normalizeRaceLabel(row?.race) === sellerRace) pct += Number(row?.tradePct) || 0;
  }
  for (const row of seller?.system?.details?.raceModsSelling ?? []) {
    if (buyerRace && normalizeRaceLabel(row?.race) === buyerRace) pct += Number(row?.tradePct) || 0;
  }
  return pct;
}

/** basePrice in gp (or any currency unit); returns adjusted total in same unit. */
export function adjustedGearPrice(basePriceNumber, buyer, seller) {
  const n = Number(basePriceNumber);
  if (!Number.isFinite(n)) return 0;
  const pct = computeGearPricePercentTotal(buyer, seller);
  return Math.round(n * (1 + pct / 100) * 100) / 100;
}
