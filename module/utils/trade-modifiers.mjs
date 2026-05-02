/**
 * Gear price modifiers when `buyer` purchases from `seller`.
 * Factions: embedded Item documents (type `faction`) stack system.gearPct; legacy affiliation rows still count if no items.
 */

export function normalizeRaceLabel(s) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function buyerFactionGearPctTotal(buyer) {
  const items = buyer?.items?.filter((i) => i.type === "faction") ?? [];
  if (items.length) return items.reduce((sum, i) => sum + (Number(i.system?.gearPct) || 0), 0);
  const legacy = buyer?.system?.details?.factionAffiliations ?? [];
  return legacy.reduce((sum, r) => sum + (Number(r?.gearPct) || 0), 0);
}

/**
 * Total percent adjustment (e.g. −10 and +5 → −5).
 * Counts: buyer faction items (or legacy affiliation rows); buyer race rows vs seller race; seller selling-rows vs buyer race.
 */
export function computeGearPricePercentTotal(buyer, seller) {
  let pct = buyerFactionGearPctTotal(buyer);
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
