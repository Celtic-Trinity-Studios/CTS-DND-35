export function getSkillRankCap(totalLevel, isClassSkill) {
  if (isClassSkill) return totalLevel + 3;
  return Math.floor((totalLevel + 3) / 2);
}

const ALIGNMENT_CODES = new Set(["lg", "ng", "cg", "ln", "tn", "cn", "le", "ne", "ce"]);

function normalizeAlignmentCode(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  if (ALIGNMENT_CODES.has(raw)) return raw;
  const table = {
    "lawful good": "lg",
    "neutral good": "ng",
    "chaotic good": "cg",
    "lawful neutral": "ln",
    "true neutral": "tn",
    "neutral": "tn",
    "chaotic neutral": "cn",
    "lawful evil": "le",
    "neutral evil": "ne",
    "chaotic evil": "ce"
  };
  return table[raw] || "";
}

function axisOfAlignment(code) {
  const c = normalizeAlignmentCode(code);
  return {
    lawChaos: c.startsWith("l") ? "lawful" : c.startsWith("c") ? "chaotic" : "neutral",
    goodEvil: c.endsWith("g") ? "good" : c.endsWith("e") ? "evil" : "neutral"
  };
}

function alignmentRequirementMatches(requirement, actorAlignment) {
  const req = String(requirement || "").trim().toLowerCase();
  if (!req || req === "none" || req === "any") return true;
  const actorCode = normalizeAlignmentCode(actorAlignment);
  if (!actorCode) return false;
  const actorAxis = axisOfAlignment(actorCode);

  if (ALIGNMENT_CODES.has(req)) return req === actorCode;
  const exactCode = normalizeAlignmentCode(req);
  if (exactCode) return exactCode === actorCode;

  if (req === "any nonlawful") return actorAxis.lawChaos !== "lawful";
  if (req === "any nonchaotic") return actorAxis.lawChaos !== "chaotic";
  if (req === "any nongood") return actorAxis.goodEvil !== "good";
  if (req === "any nonevil") return actorAxis.goodEvil !== "evil";

  if (req === "any lawful") return actorAxis.lawChaos === "lawful";
  if (req === "any chaotic") return actorAxis.lawChaos === "chaotic";
  if (req === "any good") return actorAxis.goodEvil === "good";
  if (req === "any evil") return actorAxis.goodEvil === "evil";
  if (req === "any neutral") return actorAxis.lawChaos === "neutral" || actorAxis.goodEvil === "neutral";

  return true;
}

export function getSkillPointCost(isClassSkill, rankDelta = 1) {
  return isClassSkill ? rankDelta : rankDelta * 2;
}

export function getKnownFeatNames(actor) {
  return new Set((actor?.items || []).filter((i) => i.type === "feat").map((i) => i.name.toLowerCase()));
}

export function evaluateFeatPrerequisites({ prereqText, abilities, bab, totalLevel, knownFeatNames, allFeatNames, featName, actor, skillCatalog = {} }) {
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

  const actorSkills = actor?.system?.skills || {};
  const actorFeatures = new Set((actor?.items || []).map((i) => String(i.name || "").toLowerCase()));
  const actorRace = String(actor?.system?.details?.race || "").toLowerCase();
  const actorAlignment = String(actor?.system?.details?.alignment || "").toLowerCase();

  const raceWords = ["human", "elf", "dwarf", "gnome", "halfling", "half-elf", "half-orc", "orc"];
  for (const race of raceWords) {
    const rx = new RegExp(`\\b${race.replace("-", "[- ]?")}\\b`, "i");
    if (rx.test(raw) && !actorRace.includes(race.replace("-", " "))) {
      reasons.push(`Race requirement: ${race}`);
      break;
    }
  }

  const alignmentPhrases = [
    "lawful good", "neutral good", "chaotic good",
    "lawful neutral", "true neutral", "chaotic neutral",
    "lawful evil", "neutral evil", "chaotic evil",
    "any nonlawful", "any nonchaotic", "any nongood", "any nonevil",
    "any lawful", "any chaotic", "any good", "any evil", "any neutral", "any"
  ];
  for (const phrase of alignmentPhrases) {
    if (!text.includes(phrase)) continue;
    if (!alignmentRequirementMatches(phrase, actorAlignment)) {
      reasons.push(`Alignment requirement: ${phrase}`);
      break;
    }
  }

  const skillNameByNormalizedLabel = Object.entries(skillCatalog).reduce((acc, [key, data]) => {
    const lbl = String(data?.label || key).toLowerCase().replace(/[^a-z0-9]/g, "");
    acc[lbl] = key;
    return acc;
  }, {});
  const skillMatches = [...raw.matchAll(/([A-Za-z][A-Za-z ()'-]+?)\s+([0-9]+)\s+ranks?/gi)];
  for (const m of skillMatches) {
    const label = String(m[1] || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const req = Number(m[2]) || 0;
    const skillKey = skillNameByNormalizedLabel[label] || label;
    const have = Number(actorSkills?.[skillKey]?.ranks) || 0;
    if (have < req) reasons.push(`${m[1].trim()} ${req} ranks required`);
  }

  const spellReq = raw.match(/able to cast\s+(\d+)(?:st|nd|rd|th)?-level\s+(arcane|divine)?\s*spells?/i);
  if (spellReq) {
    const reqLevel = Number(spellReq[1]) || 0;
    const reqType = String(spellReq[2] || "").toLowerCase();
    const classes = Object.values(actor?.system?.spellcasting?.classes || {});
    const ok = classes.some((c) => {
      const type = String(c?.type || "").toLowerCase();
      if (reqType && !type.includes(reqType)) return false;
      const levels = Object.keys(c?.spellsPerDay || {}).map((n) => Number(n)).filter((n) => Number.isFinite(n));
      return levels.some((n) => n >= reqLevel && (Number(c.spellsPerDay?.[n]) || 0) > 0);
    });
    if (!ok) reasons.push(`Able to cast ${reqLevel}${["th", "st", "nd", "rd"][reqLevel % 10] || "th"}-level ${reqType || ""} spells required`.trim());
  }

  if (text.includes("turn undead") && !actorFeatures.has("turn undead")) reasons.push("Requires Turn Undead");
  if (text.includes("sneak attack") && !Array.from(actorFeatures).some((n) => n.includes("sneak attack"))) reasons.push("Requires Sneak Attack");

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
  const alignment = String(actor?.system?.details?.alignment || "").toLowerCase();
  const actorSkills = actor?.system?.skills || {};
  const actorFeatures = new Set((actor?.items || []).map((i) => String(i.name || "").toLowerCase()));
  const spellClasses = Object.values(actor?.system?.spellcasting?.classes || {});
  const actorLanguages = Array.isArray(actor?.system?.traits?.languages)
    ? actor.system.traits.languages.map((l) => String(l).toLowerCase())
    : String(actor?.system?.traits?.languages || "").split(",").map((l) => l.trim().toLowerCase()).filter(Boolean);

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

  const reqAlign = String(requirements.req_alignment || "").trim().toLowerCase();
  if (reqAlign && reqAlign !== "none") {
    if (!alignmentRequirementMatches(reqAlign, alignment)) {
      reasons.push(`Alignment requirement: ${reqAlign}`);
    }
  }

  const reqSkill = String(requirements.req_skill || "").trim();
  if (reqSkill && reqSkill.toLowerCase() !== "none") {
    const matches = [...reqSkill.matchAll(/([A-Za-z][A-Za-z ()'-]+?)\s+([0-9]+)\s*ranks?/gi)];
    for (const m of matches) {
      const req = Number(m[2]) || 0;
      const rawName = String(m[1] || "").trim().toLowerCase();
      const hit = Object.entries(actorSkills).find(([k]) => k.toLowerCase() === rawName || rawName.includes(k.toLowerCase()));
      const have = Number(hit?.[1]?.ranks) || 0;
      if (have < req) {
        reasons.push(`Skill requirement: ${m[1].trim()} ${req} ranks`);
        break;
      }
    }
  }

  const reqSpells = String(requirements.req_spells || "").trim();
  if (reqSpells && reqSpells.toLowerCase() !== "none") {
    const m = reqSpells.match(/(\d+)(?:st|nd|rd|th)?-level\s+(arcane|divine)?\s*spells?/i);
    if (m) {
      const lvl = Number(m[1]) || 0;
      const type = String(m[2] || "").toLowerCase();
      const ok = spellClasses.some((c) => {
        const cType = String(c?.type || "").toLowerCase();
        if (type && !cType.includes(type)) return false;
        return Object.entries(c?.spellsPerDay || {}).some(([sl, n]) => Number(sl) >= lvl && (Number(n) || 0) > 0);
      });
      if (!ok) reasons.push(`Spell requirement: ${reqSpells}`);
    } else if (!spellClasses.length) {
      reasons.push(`Spell requirement: ${reqSpells}`);
    }
  }

  const reqSpecial = String(requirements.req_special || "").trim();
  if (reqSpecial && reqSpecial.toLowerCase() !== "none") {
    const needed = reqSpecial.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    const ok = needed.every((n) => Array.from(actorFeatures).some((f) => f.includes(n)));
    if (!ok) reasons.push(`Special requirement: ${reqSpecial}`);
  }

  const reqLang = String(requirements.req_languages || "").trim();
  if (reqLang && reqLang.toLowerCase() !== "none") {
    const needed = reqLang.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    const ok = needed.every((n) => actorLanguages.some((l) => l.includes(n)));
    if (!ok) reasons.push(`Language requirement: ${reqLang}`);
  }

  const reqPsi = String(requirements.req_psionics || "").trim();
  if (reqPsi && reqPsi.toLowerCase() !== "none") {
    const hasPsionics = spellClasses.some((c) => String(c?.type || "").toLowerCase().includes("psionic"))
      || Array.from(actorFeatures).some((f) => f.includes("psionic"));
    if (!hasPsionics) reasons.push(`Psionics requirement: ${reqPsi}`);
  }

  const reqWeapon = String(requirements.req_weapon_proficiency || "").trim();
  if (reqWeapon && reqWeapon.toLowerCase() !== "none") {
    const ok = Array.from(actorFeatures).some((f) => f.includes(reqWeapon.toLowerCase()))
      || Array.from(knownFeatNames).some((f) => f.includes(reqWeapon.toLowerCase()));
    if (!ok) reasons.push(`Weapon proficiency requirement: ${reqWeapon}`);
  }

  const reqEpic = String(requirements.req_epic_feat || "").trim();
  if (reqEpic && reqEpic.toLowerCase() !== "none") {
    if (!knownFeatNames.has(reqEpic.toLowerCase())) reasons.push(`Epic feat requirement: ${reqEpic}`);
  }

  return { ok: reasons.length === 0, reasons };
}
