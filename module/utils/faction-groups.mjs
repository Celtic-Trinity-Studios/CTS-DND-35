/** Shared parsing for system.details.groups (comma / semicolon / newline). */

export function parseGroupTokens(raw) {
  if (!raw || typeof raw !== "string") return [];
  return raw
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function normalizeGroupsForSave(tokens) {
  const seen = new Set();
  const out = [];
  for (const t of tokens) {
    const k = t.trim().toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(t.trim());
  }
  return out.join(", ");
}

export function normalizeGroupsFromRaw(stringValue) {
  return normalizeGroupsForSave(parseGroupTokens(stringValue));
}

/** Labels used for actor sidebar filters (legacy string + structured factions). */
export function actorFactionFilterTokens(actor) {
  const set = new Set();
  for (const t of parseGroupTokens(actor?.system?.details?.groups)) set.add(t);
  for (const row of actor?.system?.details?.factionAffiliations ?? []) {
    const n = String(row?.name ?? "").trim();
    if (n) set.add(n);
  }
  return [...set];
}
