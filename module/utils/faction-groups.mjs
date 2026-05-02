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
