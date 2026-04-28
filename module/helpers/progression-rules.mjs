export function getSkillRankCap(totalLevel, isClassSkill) {
  if (isClassSkill) return totalLevel + 3;
  return Math.floor((totalLevel + 3) / 2);
}

export function getSkillPointCost(isClassSkill, rankDelta = 1) {
  return isClassSkill ? rankDelta : rankDelta * 2;
}

export function getKnownFeatNames(actor) {
  return new Set((actor?.items || []).filter((i) => i.type === "feat").map((i) => i.name.toLowerCase()));
}

export function evaluateFeatPrerequisites({ prereqText, abilities, bab, totalLevel, knownFeatNames, allFeatNames, featName }) {
  const raw = String(prereqText || "").trim();
  if (!raw) return { ok: true, reasons: [] };

  const reasons = [];
  const text = raw.toLowerCase();
  const safeAbilities = abilities || {};

  const abilityMatchers = [
    ["str", /\bstr(?:ength)?\s*([0-9]{1,2})\b/i],
    ["dex", /\bdex(?:terity)?\s*([0-9]{1,2})\b/i],
    ["con", /\bcon(?:stitution)?\s*([0-9]{1,2})\b/i],
    ["int", /\bint(?:elligence)?\s*([0-9]{1,2})\b/i],
    ["wis", /\bwis(?:dom)?\s*([0-9]{1,2})\b/i],
    ["cha", /\bcha(?:risma)?\s*([0-9]{1,2})\b/i]
  ];
  for (const [key, rx] of abilityMatchers) {
    const m = raw.match(rx);
    if (!m) continue;
    const need = Number(m[1]) || 0;
    const have = Number(safeAbilities[key]?.value) || 0;
    if (have < need) reasons.push(`${key.toUpperCase()} ${need}+ required`);
  }

  const babMatch = raw.match(/(?:base attack bonus|bab)\s*\+?\s*([0-9]+)/i);
  if (babMatch) {
    const needBab = Number(babMatch[1]) || 0;
    const haveBab = Number(bab) || 0;
    if (haveBab < needBab) reasons.push(`BAB +${needBab} required`);
  }

  const levelMatch = raw.match(/(?:character level|level)\s*([0-9]+)/i);
  if (levelMatch) {
    const needLvl = Number(levelMatch[1]) || 0;
    const haveLvl = Number(totalLevel) || 0;
    if (haveLvl < needLvl) reasons.push(`Level ${needLvl}+ required`);
  }

  const allNames = allFeatNames || [];
  const current = knownFeatNames || new Set();
  const selfName = String(featName || "").toLowerCase();
  for (const known of allNames) {
    const lower = known.toLowerCase();
    if (!lower || lower === selfName) continue;
    if (!text.includes(lower)) continue;
    if (!current.has(lower)) reasons.push(`Requires feat: ${known}`);
  }

  return { ok: reasons.length === 0, reasons };
}
