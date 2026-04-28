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

function normalizeFeatureTable(rawFeatureData) {
  if (!rawFeatureData) return {};
  if (typeof rawFeatureData === "string") {
    try {
      return normalizeFeatureTable(JSON.parse(rawFeatureData));
    } catch {
      return {};
    }
  }
  if (Array.isArray(rawFeatureData)) {
    const table = {};
    for (const row of rawFeatureData) {
      if (!row) continue;
      const level = Number(row.level) || Number(row.lvl) || 0;
      if (!level) continue;
      const entries = Array.isArray(row.features) ? row.features : [row.feature || row.name].filter(Boolean);
      if (!entries.length) continue;
      table[level] = [...(table[level] || []), ...entries.map((e) => String(e).trim()).filter(Boolean)];
    }
    return table;
  }
  if (typeof rawFeatureData === "object") {
    const table = {};
    for (const [k, v] of Object.entries(rawFeatureData)) {
      const level = Number(k) || Number(v?.level) || 0;
      if (!level) continue;
      const entries = Array.isArray(v) ? v : Array.isArray(v?.features) ? v.features : [v?.feature || v?.name || v].filter(Boolean);
      table[level] = entries.map((e) => String(e).trim()).filter(Boolean);
    }
    return table;
  }
  return {};
}

function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function getClassFeatureGrants(classSystem, fromLevel, toLevel) {
  const start = Math.max(0, Number(fromLevel) || 0);
  const end = Math.max(start, Number(toLevel) || 0);
  const featureTable = normalizeFeatureTable(
    classSystem?.featuresByLevel
    || classSystem?.classFeaturesByLevel
    || classSystem?.classFeatures
    || classSystem?.features
  );
  const grants = [];
  for (let level = start + 1; level <= end; level++) {
    const entries = featureTable[level] || [];
    for (const name of entries) {
      grants.push({
        name,
        level,
        key: `${slugify(name)}@${level}`
      });
    }
  }
  return grants;
}

export function getSpellcastingProgression(classSystem, className, classLevel, actorSpellcasting = {}) {
  const spellcasting = classSystem?.spellcasting || {};
  const type = String(spellcasting.type || "none").toLowerCase();
  if (!type || type === "none") return null;

  const key = slugify(className) || "class";
  const level = Math.max(0, Number(classLevel) || 0);
  const existing = actorSpellcasting?.classes?.[key] || {};
  const progressionRaw = spellcasting.progression || spellcasting.spellsPerDayByLevel || {};
  const progression = typeof progressionRaw === "string" ? (() => {
    try { return JSON.parse(progressionRaw); } catch { return {}; }
  })() : progressionRaw;
  const levelRow = progression?.[level] || progression?.[String(level)] || {};

  return {
    key,
    data: {
      className,
      type,
      ability: spellcasting.ability || existing.ability || "",
      classLevel: level,
      casterLevel: level,
      spellsPerDay: levelRow.spellsPerDay || levelRow.perDay || existing.spellsPerDay || {},
      spellsKnown: levelRow.spellsKnown || levelRow.known || existing.spellsKnown || {}
    }
  };
}

export function evaluateClassAvailability({ requirements = {}, actor = {}, knownFeatNames = new Set() }) {
  const reasons = [];
  const race = String(actor?.system?.details?.race || "").toLowerCase();
  const bab = Number(actor?.system?.attributes?.bab?.total) || 0;

  const reqBab = Number(requirements.req_base_attack_bonus) || 0;
  if (reqBab > 0 && bab < reqBab) reasons.push(`BAB +${reqBab} required`);

  const reqRace = String(requirements.req_race || "").trim();
  if (reqRace && reqRace.toLowerCase() !== "none") {
    const races = reqRace.split(",").map((r) => r.trim().toLowerCase()).filter(Boolean);
    if (races.length && !races.some((r) => race.includes(r))) reasons.push(`Race requirement: ${reqRace}`);
  }

  const reqFeat = String(requirements.req_feat || "").trim();
  if (reqFeat && reqFeat.toLowerCase() !== "none") {
    const feats = reqFeat.split(",").map((f) => f.trim()).filter(Boolean);
    for (const feat of feats) {
      if (!knownFeatNames.has(feat.toLowerCase())) {
        reasons.push(`Requires feat: ${feat}`);
        break;
      }
    }
  }

  return { ok: reasons.length === 0, reasons };
}
