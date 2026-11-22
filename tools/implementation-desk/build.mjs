/**
 * Rebuild tools/implementation-desk/index.html from the mechanics gap analysis.
 *
 * Run from the repo root:
 *   node tools/implementation-desk/build.mjs
 *
 * Rows come from docs/MECHANICS-GAP-ANALYSIS.md. RULES below refile a row
 * into a more useful area. Everything else stays with its audit section.
 * Checks and notes are not in the markdown — the page stores those in the browser.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const gapPath = path.join(root, "docs", "MECHANICS-GAP-ANALYSIS.md");
const templatePath = path.join(here, "page.html");
const outPath = path.join(here, "index.html");

const CATEGORIES = [
  {
    id: "pipeline",
    group: "First",
    short: "One bonus path",
    title: "Start here — one bonus path",
    blurb: "Feats, items, buffs, and conditions should change AC, saves, skills, and attacks through one stacking path. Later rules get much smaller once this exists.",
  },
  {
    id: "armor",
    group: "First",
    short: "Armor and load",
    title: "Armor, weight, and the penalties they cause",
    blurb: "Armor check penalty, spell failure, speed loss, and carrying capacity — including the skills those penalties touch.",
  },
  {
    id: "character",
    group: "Play",
    short: "The character",
    title: "The character",
    blurb: "Scores, hit points, senses, movement, and identity that are still incomplete.",
  },
  {
    id: "levels",
    group: "Play",
    short: "Levels and classes",
    title: "Levels and class gains",
    blurb: "Hit dice, skill points, features granted by level, prestige entry, familiars, and multiclass math.",
  },
  {
    id: "skills",
    group: "Play",
    short: "Skills",
    title: "Skills",
    blurb: "Synergies, take 10, opposed checks, and the individual skills that still have no procedure.",
  },
  {
    id: "feats",
    group: "Play",
    short: "Feats and features",
    title: "Feats and features",
    blurb: "Prerequisites, bonus-feat budgets, metamagic, and class or race features that should change the sheet.",
  },
  {
    id: "attacking",
    group: "Play",
    short: "Attacking",
    title: "Attacking",
    blurb: "The attack roll, extra attacks, critical hits, and damage that is still applied by hand.",
  },
  {
    id: "defense",
    group: "Play",
    short: "Defense",
    title: "Defense",
    blurb: "What is left of AC, saves, damage reduction, energy, and miss chance after the shared bonus path.",
  },
  {
    id: "round",
    group: "Play",
    short: "The combat round",
    title: "The combat round",
    blurb: "Actions, movement, attacks of opportunity, flanking, and maneuvers.",
  },
  {
    id: "conditions",
    group: "Play",
    short: "Conditions",
    title: "Conditions and recovery",
    blurb: "Status effects, poison, dying, and healing.",
  },
  {
    id: "gear",
    group: "Play",
    short: "Gear",
    title: "Gear",
    blurb: "Hands, materials, ammunition, charges, and body slots.",
  },
  {
    id: "spells",
    group: "Play",
    short: "Spellcasting",
    title: "Spellcasting",
    blurb: "Preparing, spending slots, and getting a spell from the sheet into the world.",
  },
  {
    id: "monsters",
    group: "Play",
    short: "Monsters",
    title: "Monsters and encounters",
    blurb: "Type traits, special attacks, challenge ratings, and treasure.",
  },
  {
    id: "place",
    group: "Play",
    short: "Battlefield and wild",
    title: "The battlefield and the wild",
    blurb: "Terrain, hazards, light, and token rules that should match the sheet.",
  },
  {
    id: "town",
    group: "Play",
    short: "Talk and coin",
    title: "Talk, time, and coin",
    blurb: "Social checks, downtime, crafting, and prices. Faction trade that already works stays in this area, marked in the system.",
  },
  {
    id: "authoring",
    group: "Play",
    short: "Authoring",
    title: "Authoring",
    blurb: "Formula help and documented hooks, so the remaining gaps can be scripted.",
  },
  {
    id: "psionics",
    group: "Optional",
    parked: true,
    short: "Psionics",
    title: "Psionics",
    blurb: "Expanded Psionics Handbook. Off the main count until you include it.",
  },
  {
    id: "books",
    group: "Optional",
    parked: true,
    short: "Other books",
    title: "Other books",
    blurb: "Epic, incarnum, the Tomes, and setting books. Left off on purpose. Put one on the list only if you mean to build it.",
  },
];

const ROADMAP = [
  {
    id: "pipeline",
    title: "One bonus path",
    blurb: "One route from equipped items, buffs, and conditions into AC, saves, skills, speed, attack, and damage.",
  },
  {
    id: "armor",
    title: "Armor and load",
    blurb: "Check penalty, spell failure, speed, weight, and the skill penalties that follow from them.",
  },
  {
    id: "combat",
    title: "Combat math",
    blurb: "Attack breakdowns, critical hits, damage reduction, and energy. Iterative attacks already roll.",
  },
  {
    id: "spells",
    title: "Spellcasting",
    blurb: "Slots, difficulty class, caster level, concentration, and armor failure, from the sheet through the cast.",
  },
  {
    id: "actions",
    title: "The combat round",
    blurb: "Attacks of opportunity, flanking, reach, and the maneuvers around them.",
  },
  {
    id: "canvas",
    title: "The map",
    blurb: "Threat and vision that follow the sheet. Worth doing after reach is trustworthy.",
  },
  {
    id: "conditions",
    title: "Conditions and healing",
    blurb: "Status effects that change numbers, plus dying and stable.",
  },
  {
    id: "monsters",
    title: "Monsters",
    blurb: "Treasure, spell-like counters, and type tags before a full trait engine.",
  },
  {
    id: "authoring",
    title: "Authoring",
    blurb: "Formulas and documented hooks for the gaps you still resolve by hand.",
  },
];

/** First match wins. Patterns run against a normalized lowercase title. */
const RULES = [
  { cat: "pipeline", test: /circumstance \/ competence \/ insight/ },
  { cat: "pipeline", test: /stacking rules \(same-source/ },
  { cat: "pipeline", test: /passive numeric bonuses from feats/ },
  { cat: "pipeline", test: /dodge, deflection, insight/ },
  { cat: "pipeline", test: /saving throw bonuses by source/ },
  { cat: "pipeline", test: /circumstance bonuses on saves/ },
  { cat: "pipeline", test: /active effects driving mods/ },
  { cat: "pipeline", test: /melee attack bonus decomposition/ },
  { cat: "armor", test: /armor check penalty on skills/ },
  { cat: "armor", test: /double armor penalty/ },
  { cat: "armor", test: /fatigue \/ encumbrance to skills/ },
  { cat: "armor", test: /^speed - land/ },
  { cat: "armor", test: /^armor stats \(bonus, max dex/ },
  { cat: "armor", test: /^weight & encumbrance$/ },
  { cat: "armor", test: /load limits by strength/ },
  { cat: "armor", test: /medium \/ heavy encumbrance penalties/ },
  { cat: "town", test: /appraise tied to trade/ },
  { cat: "place", test: /threatened-area overlay/ },
  { cat: "round", test: /automatic flanking/ },
  { cat: "gear", test: /equipment slot enforcement/ },
  { cat: "gear", test: /advanced ammunition/ },
  { cat: "monsters", test: /npc treasure blocks/ },
  { cat: "round", test: /optional heavy combat tracker/ },
  { cat: "round", test: /encounter \/ initiative extensions/ },
];

const SECTION_CATEGORY = {
  1: "character",
  2: "levels",
  3: "skills",
  4: "feats",
  5: "attacking",
  6: "defense",
  7: "round",
  8: "conditions",
  9: "gear",
  10: "spells",
  11: "psionics",
  12: "monsters",
  13: "place",
  14: "town",
  15: "town",
  16: "place",
  17: "authoring",
  20: "books",
};

function plain(md) {
  return String(md || "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function keyOf(title) {
  return plain(title)
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[—–]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function auditOf(cell, section) {
  const text = plain(cell);
  if (/out of scope/i.test(text)) return "out";
  if (/\bpartial\b/i.test(text)) return "partial";
  if (/\bmissing\b/i.test(text)) return "missing";
  if (/\bpresent\b/i.test(text)) return "present";
  if (section === 20) return "out";
  return null;
}

function roadmapOf(cat, section) {
  switch (cat) {
    case "pipeline":
      return "pipeline";
    case "armor":
      return "armor";
    case "attacking":
    case "defense":
      return "combat";
    case "spells":
      return "spells";
    case "round":
      return "actions";
    case "conditions":
      return "conditions";
    case "monsters":
      return "monsters";
    case "authoring":
      return "authoring";
    case "place":
      return section === 13 ? null : "canvas";
    default:
      return null;
  }
}

function slug(section, title, used) {
  const base = `${section}-${keyOf(title).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 72)}`;
  let id = base || `${section}-row`;
  let n = 2;
  while (used.has(id)) id = `${base}-${n++}`;
  used.add(id);
  return id;
}

function parseGap(markdown) {
  const items = [];
  const used = new Set();
  let section = 0;
  let sectionTitle = "";
  let table = [];

  function flush() {
    if (!table.length || !SECTION_CATEGORY[section]) {
      table = [];
      return;
    }
    for (const line of table) {
      if (!line.trim().endsWith("|")) continue;
      const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
      if (!cells.length) continue;
      if (cells.every((cell) => /^:?-{3,}:?$/.test(cell))) continue;
      const head = plain(cells[0]).toLowerCase();
      if (head === "topic" || head === "capability") continue;
      const title = plain(cells[0]);
      if (!title) continue;
      const audit = auditOf(cells[1] || "", section);
      if (!audit) {
        throw new Error(`No status for §${section} “${title}”`);
      }
      let gap = plain(cells[2] || "");
      if (!gap) {
        gap = audit === "out"
          ? plain(cells[1] || "")
          : plain(cells[1] || "").replace(/^(Present|Partial|Missing|Out of scope)\b\s*/i, "").trim();
      }
      items.push({
        id: slug(section, title, used),
        title,
        audit,
        gap,
        section,
        sectionTitle,
        order: items.length,
      });
    }
    table = [];
  }

  for (const line of markdown.split(/\r?\n/)) {
    const heading = line.match(/^##\s+(\d+)\.\s+(.+)$/);
    if (heading) {
      flush();
      section = Number(heading[1]);
      sectionTitle = plain(heading[2]);
      continue;
    }
    if (line.startsWith("|")) {
      table.push(line);
      continue;
    }
    if (table.length) flush();
  }
  flush();
  return items;
}

function assign(items) {
  const hits = RULES.map(() => []);
  for (const item of items) {
    const key = keyOf(item.title);
    const index = RULES.findIndex((rule) => rule.test.test(key));
    const fallback = SECTION_CATEGORY[item.section];
    if (!fallback) throw new Error(`No category for section ${item.section}`);
    if (index >= 0) {
      hits[index].push(item.title);
      item.cat = RULES[index].cat;
      item.moved = item.cat !== fallback;
    } else {
      item.cat = fallback;
      item.moved = false;
    }
    item.roadmap = roadmapOf(item.cat, item.section);
    if (!CATEGORIES.some((cat) => cat.id === item.cat)) {
      throw new Error(`Unknown category ${item.cat} on ${item.title}`);
    }
  }
  const problems = [];
  RULES.forEach((rule, index) => {
    if (hits[index].length !== 1) {
      problems.push(`${rule.test} matched ${hits[index].length}: ${hits[index].join(" | ")}`);
    }
  });
  if (problems.length) {
    throw new Error(`Regroup rules must match one row each:\n${problems.join("\n")}`);
  }
}

const items = parseGap(fs.readFileSync(gapPath, "utf8"));
assign(items);

if (items.length < 250 || items.length > 400) {
  throw new Error(`Unexpected row count: ${items.length}`);
}

const counts = items.reduce((bag, item) => {
  bag[item.audit] = (bag[item.audit] || 0) + 1;
  return bag;
}, {});
const byCat = items.reduce((bag, item) => {
  bag[item.cat] = (bag[item.cat] || 0) + 1;
  return bag;
}, {});

const data = {
  builtAt: new Date().toISOString(),
  source: "docs/MECHANICS-GAP-ANALYSIS.md",
  intro: "Every row is a D&D 3.5 rule the gap analysis still calls missing or only partly built. Areas follow the order you would build them, not the rulebook’s chapters. Badges are the audit — it can lag the code, so reopen anything that is not actually done. Checks and notes stay in this browser. Export a backup if you will open this file somewhere else.",
  regroup: [
    { title: "One bonus path", text: "pulls typed bonuses, stacking, and active effects out of skills, feats, attacks, and defense." },
    { title: "Armor and load", text: "pulls check penalty, weight, and speed loss out of skills, the character, and gear." },
    { title: "Battlefield and wild", text: "joins wilderness hazards with tokens, vision, and reach." },
    { title: "Talk and coin", text: "joins social downtime with prices and crafting. Faction trade that already works stays here as in the system." },
    { title: "The old UX grab-bag", text: "is split: threat goes to the battlefield, the combat tracker to the round, ammunition to gear, treasure to monsters." },
  ],
  offpathBlurb: "These still need building. They are real rules, and they are not on the nine steps because they do not unblock the rest: identity, leveling detail, skill special cases, feat catalogs, leftover gear, town procedures, and wilderness hazards.",
  categories: CATEGORIES,
  roadmap: ROADMAP,
  items,
};

const json = JSON.stringify(data).replace(/</g, "\\u003c");
const template = fs.readFileSync(templatePath, "utf8");
if (!template.includes("__DESK_DATA__")) throw new Error("page.html is missing __DESK_DATA__");
const html = template.replace("__DESK_DATA__", json);
if (html.includes("__DESK_DATA__")) throw new Error("token remained");
fs.writeFileSync(outPath, html);

console.log(`Wrote ${path.relative(root, outPath)}`);
console.log(`Rows: ${items.length}`, counts);
console.log("By area:", byCat);
console.log(`Moved: ${items.filter((item) => item.moved).length}`);
