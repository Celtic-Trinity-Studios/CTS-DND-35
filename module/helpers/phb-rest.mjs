/**
 * Remaining Player's Handbook, DMG, and Expanded Psionics procedures.
 * Pure functions. The Combat tab Rules panel calls runProcedure.
 */

const SIZE_ORDER = ["fine", "dim", "tiny", "sm", "med", "lg", "huge", "grg", "col"];

const WBL = [
  0, 900, 2700, 5400, 9000, 13000, 19000, 27000, 36000, 49000,
  66000, 88000, 110000, 150000, 200000, 260000, 340000, 440000, 580000, 760000,
];

const MONK_DAMAGE = {
  med: ["1d6", "1d6", "1d6", "1d8", "1d8", "1d8", "1d8", "1d10", "1d10", "1d10", "1d10", "2d6", "2d6", "2d6", "2d6", "2d8", "2d8", "2d8", "2d8", "2d10"],
  sm: ["1d4", "1d4", "1d4", "1d6", "1d6", "1d6", "1d6", "1d8", "1d8", "1d8", "1d8", "1d10", "1d10", "1d10", "1d10", "2d6", "2d6", "2d6", "2d6", "2d8"],
};

function n(value) {
  return Math.floor(Number(value) || 0);
}

function linesOf(text) {
  return { formula: null, lines: Array.isArray(text) ? text : [text] };
}

export function classLevel(classes = [], pattern) {
  return (classes || []).reduce((sum, row) => {
    if (!pattern.test(String(row.name || ""))) return sum;
    return sum + Math.max(0, n(row.level));
  }, 0);
}

export function skillTypedBonus(skill = {}) {
  const circumstance = n(skill.circumstance);
  const masterwork = skill.masterwork === true || skill.masterwork === "true" ? 2 : 0;
  const competence = n(skill.competence);
  const insight = n(skill.insight);
  return {
    circumstance: Math.max(circumstance, masterwork),
    competence,
    insight,
    total: Math.max(circumstance, masterwork) + competence + insight,
  };
}

export function monkUnarmedDamage(level, size = "med") {
  const rank = Math.max(0, n(level));
  if (!rank) return "1d3";
  const table = ["sm", "tiny", "dim", "fine"].includes(size) ? MONK_DAMAGE.sm : MONK_DAMAGE.med;
  return table[Math.min(rank, 20) - 1];
}

export function flurryPenalty(level) {
  const rank = n(level);
  if (rank >= 9) return 0;
  if (rank >= 5) return 1;
  return 2;
}

export function weaponSizePenalty(wielderSize = "med", weaponSize = "med") {
  const wielder = SIZE_ORDER.indexOf(String(wielderSize || "med"));
  const weapon = SIZE_ORDER.indexOf(String(weaponSize || "med"));
  if (wielder < 0 || weapon < 0) return { penalty: 0, note: "" };
  const steps = weapon - wielder;
  if (steps <= 0) return { penalty: 0, note: "" };
  if (steps === 1) return { penalty: 2, note: "Weapon is one size larger (−2, treat as two-handed)." };
  return { penalty: 4, note: "Weapon is two or more sizes too big (−4, and it may be unusable)." };
}

export function wealthByLevel(level) {
  const rank = Math.max(1, n(level));
  if (rank === 1) return 0;
  if (rank <= 20) return WBL[rank - 1];
  return WBL[19] + (rank - 20) * 200000;
}

export function skillPointsAtLevel({ classSkill = true, firstLevel = false, human = false } = {}) {
  const cost = classSkill ? 1 : 2;
  const points = firstLevel ? (human ? 4 : 1) : 1;
  return { cost, pointsBought: points, note: classSkill ? "Class skill costs 1 point per rank." : "Cross-class costs 2 points per rank, and the max is half." };
}

export function fighterBonusFeats(level) {
  const rank = n(level);
  if (rank <= 0) return 0;
  return 1 + Math.floor(rank / 2);
}

export function wizardBonusFeats(level) {
  const rank = n(level);
  return [1, 5, 10, 15, 20].filter((step) => rank >= step).length;
}

export function itemCreation(basePriceGp) {
  const price = Math.max(0, Number(basePriceGp) || 0);
  return {
    gold: Math.floor(price / 2),
    xp: Math.floor(price / 25),
    days: Math.max(1, Math.ceil(price / 1000)),
  };
}

export function leadership(score) {
  const leadershipScore = n(score);
  const cohort = Math.max(0, Math.floor((leadershipScore - 2) / 1) - 1);
  const followers = leadershipScore >= 10 ? [2, 2, 1] : [];
  return {
    cohortLevel: Math.max(1, leadershipScore - 2),
    followerBands: followers,
    note: `Leadership ${leadershipScore}: cohort level ${Math.max(1, leadershipScore - 2)}. Followers use DMG Table 4–25 (the score is character level + Cha + modifiers).`,
  };
}

export function encounterLevel(entries = []) {
  const groups = [];
  for (const row of entries) {
    const cr = n(row.cr);
    const count = Math.max(1, n(row.count) || 1);
    const xp = (row.xpEach || 0) * count;
    groups.push({ cr, count, xp });
  }
  const totalXp = groups.reduce((sum, row) => sum + row.xp, 0);
  return { totalXp, groups };
}

export function sameCrEncounter(cr, count) {
  const creatures = Math.max(1, n(count) || 1);
  const steps = creatures >= 16 ? 8 : creatures >= 12 ? 7 : creatures >= 8 ? 6 : creatures >= 6 ? 5 : creatures >= 4 ? 4 : creatures >= 3 ? 3 : creatures >= 2 ? 2 : 0;
  return n(cr) + steps;
}

export function naturalHealing(level, care = false) {
  const perDay = Math.max(1, n(level)) * (care ? 2 : 1);
  return { hp: perDay, ability: care ? 2 : 1 };
}

export function fallingObjectDice(pounds, feet) {
  const weightDice = Math.max(0, Math.floor(n(pounds) / 200));
  const fallDice = Math.min(20, Math.floor(n(feet) / 10));
  return weightDice + fallDice;
}

export function suffocationRounds(conScore) {
  return Math.max(0, n(conScore));
}

export function bonusPowerPoints(abilityMod, manifesterLevel) {
  const mod = n(abilityMod);
  const level = n(manifesterLevel);
  if (mod <= 0 || level <= 0) return 0;
  return Math.floor((mod * level) / 2);
}

export function dispelDc(opposingCasterLevel) {
  return 11 + Math.max(0, n(opposingCasterLevel));
}

export function turningDestructionMaxHd(clericLevel, checkTotal) {
  const level = n(clericLevel);
  const margin = n(checkTotal) - 10;
  return Math.max(0, level + margin);
}

export function bardicCourage(bardLevel) {
  const level = n(bardLevel);
  if (level >= 20) return 4;
  if (level >= 14) return 3;
  if (level >= 8) return 2;
  if (level >= 1) return 1;
  return 0;
}

export function halfTemplate(kind, { level = 1, str = 0, dex = 0, con = 0, int = 0, wis = 0, cha = 0 } = {}) {
  const name = String(kind || "").toLowerCase();
  if (name.includes("celestial")) {
    return { str: str + 4, dex: dex + 2, con: con + 4, int: int + 2, wis: wis + 4, cha: cha + 4, note: "Half-celestial: Str +4, Dex +2, Con +4, Int +2, Wis +4, Cha +4, plus smite and resistances." };
  }
  if (name.includes("fiend")) {
    return { str: str + 4, dex: dex + 4, con: con + 2, int: int + 4, wis, cha: cha + 2, note: "Half-fiend: Str +4, Dex +4, Con +2, Int +4, Cha +2, plus resistances and spell-like abilities." };
  }
  if (name.includes("lich")) {
    return { str, dex, con: 0, int: int + 2, wis: wis + 2, cha: cha + 2, note: `Lich: +2 Int, Wis, and Cha. Con becomes —. Add ${Math.max(1, n(level))} natural armor and fear aura.` };
  }
  return { note: "Name the template: half-celestial, half-fiend, or lich." };
}

export function critImmuneType(creatureType = "") {
  const type = String(creatureType || "").toLowerCase();
  return ["undead", "construct", "elemental", "ooze", "swarm"].some((key) => type.includes(key));
}

export function settlementPricePercent(size = "") {
  const key = String(size || "").toLowerCase();
  const table = { thorp: 20, hamlet: 40, village: 100, small: 100, town: 100, large: 100, city: 100, metropolis: 100 };
  if (key.includes("thorp")) return 40;
  if (key.includes("hamlet")) return 100;
  if (key.includes("village")) return 200;
  void table;
  return 100;
}

function skillTotal(ctx, key) {
  return n(ctx.skills?.[key]);
}

function levelOf(ctx, pattern) {
  return classLevel(ctx.classes, pattern);
}

const RUNNERS = {
  "skill-points": (ctx, amount) => linesOf(skillPointsAtLevel({ classSkill: amount !== 2, firstLevel: amount === 4, human: amount === 4 }).note + ` Enter 2 in the box for a cross-class rank. Level ${n(ctx.level)} max class ranks ${n(ctx.level) + 3}.`),
  "wealth-level": (ctx) => linesOf(`Wealth by level for level ${Math.max(1, n(ctx.level))}: ${wealthByLevel(ctx.level)} gp (DMG Table 5–1). Level 1 uses class starting gold instead.`),
  "starting-gold": (_ctx, amount) => linesOf(`Starting gold roll average is about ${amount || 100} gp. Fighters and paladins roll 6d4×10, wizards 3d4×10, rogues 5d4×10.`),
  "xp-award": (ctx, amount) => {
    const penalty = n(ctx.xpPenalty);
    const kept = Math.floor((amount || 0) * (100 - penalty) / 100);
    return linesOf(`Award ${amount || 0} XP. Multiclass penalty ${penalty}% leaves ${kept}. Add it to the XP field.`);
  },
  "la-buyoff": (ctx, amount) => linesOf(`Level adjustment ${amount || 1} costs ${(amount || 1) * (n(ctx.level) + (amount || 1)) * 1000} XP to buy off one step (Unearthed Arcana: current ECL × 1,000).`),
  "hp-history": (ctx, amount) => linesOf(`Record ${amount || 0} hit points for this level. Max at this level is the hit die. Running max on the sheet is ${n(ctx.hpMax)}.`),
  "racial-hd": (ctx, amount) => linesOf(`Racial Hit Dice ${amount || 0} add their own BAB and saves. Put that class-like row on the sheet, or add the BAB in the racial HD field.`),
  "gestalt": (ctx) => linesOf(ctx.gestalt ? "Gestalt is on: BAB and each save use the better class at this level, not the sum." : "Turn on Gestalt on Identity to stop multiclass BAB and saves from stacking."),
  "companion": (ctx) => linesOf(ctx.companion ? `Linked companion: ${ctx.companion}.` : "Paste the companion actor’s id into Linked companion on Identity."),
  "aid-another": (ctx, amount) => ({ formula: `1d20 + ${skillTotal(ctx, "any") || n(ctx.bab)}`, lines: [`Aid another DC ${amount || 10}. Success gives the ally +2.`] }),
  "opposed": (ctx, amount) => ({ formula: `1d20 + ${amount || 0}`, lines: ["Opposed check. Higher total wins. A tie favors the defender or is rolled again."] }),
  "take-10": (ctx) => linesOf(ctx.distracted ? "Take 10 is not allowed while threatened or distracted." : "Take 10 is the skill total plus 10. Hover a skill total to see it."),
  "craft-income": (ctx, amount) => {
    const check = 10 + skillTotal(ctx, "crf");
    const dc = amount || 10;
    return linesOf(`Craft a week at DC ${dc}: about ${check} × ${dc} = ${check * dc} sp if you take 10 (${Math.floor((check * dc) / 10)} gp).`);
  },
  "profession-income": (ctx) => linesOf(`Profession for a week, taking 10: ${Math.floor((10 + skillTotal(ctx, "pro")) / 2)} gp.`),
  "decipher": (ctx, amount) => linesOf(`Decipher Script DC ${amount || 20}. One page per minute on a success. A failure cannot be retried on that page until you gain a rank.`),
  "appraise": (_ctx, amount) => linesOf(`Appraise DC ${amount || 12} (12 common, 15 rare, 20 exotic). A success estimates value within 10%. Failure is off by one band.`),
  "knowledge": (_ctx, amount) => linesOf(`Knowledge DC ${amount || 15}. 10 common, 15 uncommon, 20 rare or specific, 25 obscure, 30 mythic.`),
  "survival-track": (_ctx, amount) => linesOf(`Survival track DC ${amount || 15}. Very soft 5, soft 10, firm 15, hard 20. Each day since the trail and each size step smaller adds 2 or more.`),
  "survival-wild": (ctx) => linesOf(`Get along in the wild DC 10. Forecast weather DC 15. Take 10 with Survival ${skillTotal(ctx, "sur")} is ${10 + skillTotal(ctx, "sur")}.`),
  "umd": (_ctx, amount) => linesOf(`Use Magic Device DC ${amount || 25}. Activate blindly 25, emulate class feature 20, race 25, ability score 15 + the score, alignment 30.`),
  "jump": (ctx, amount) => {
    const feet = amount || 10;
    const dc = feet;
    const have = skillTotal(ctx, "jmp");
    return linesOf(`Long jump ${feet} ft is DC ${dc} with a 20 ft running start. Standing doubles the DC to ${dc * 2}. High jump is DC ${feet * 4}. Your Jump total is ${have}.`);
  },
  "balance": (_ctx, amount) => linesOf(`Balance DC ${amount || 10}. Uneven 10, narrow 15, very narrow 20. Slippery +5. Failure by 5 or more is a fall.`),
  "tumble": (_ctx, amount) => linesOf(`Tumble DC ${amount || 15} to move through an opponent’s square, or 25 to tumble through a threatened square without an attack of opportunity.`),
  "swim-dc": (ctx) => linesOf(`Swim DC 10 calm, 15 rough, 20 stormy. Your Swim total is ${skillTotal(ctx, "swm")} and already includes double the armor check penalty.`),
  "rope": (_ctx, amount) => linesOf(`Use Rope DC ${amount || 10}. Secure a grappling hook 10, bind a captive 15, splice 15.`),
  "language": (ctx) => linesOf(`Speak Language: one rank is one language. Literate is ${ctx.literate ? "yes" : "not set"} on Identity.`),
  "retry": () => linesOf("Climb, Jump, and Tumble can be tried again. Use Magic Device, Decipher Script, and Appraise on the same subject wait until circumstances change or a rank is gained."),
  "feat-slots": (ctx) => linesOf(`Fighter bonus feats through level ${levelOf(ctx, /^fighter\b/i)}: ${fighterBonusFeats(levelOf(ctx, /^fighter\b/i))}. Wizard bonus feats: ${wizardBonusFeats(levelOf(ctx, /^wizard\b/i))} (levels 1, 5, 10, 15, 20). Character level ${n(ctx.level)} also grants a feat at 1 and every 3 levels (${1 + Math.floor(n(ctx.level) / 3)}).`),
  "item-creation": (_ctx, amount) => {
    const made = itemCreation(amount || 1000);
    return linesOf(`Craft price ${amount || 1000} gp: spend ${made.gold} gp, ${made.xp} XP, and ${made.days} day(s). You need the matching item creation feat and the spell.`);
  },
  leadership: (ctx, amount) => linesOf(leadership((amount || n(ctx.level) + n(ctx.cha))).note),
  "flaw": () => linesOf("A flaw is a −2 penalty you write into the matching misc field, and it grants one bonus feat. Two flaws is the usual cap."),
  "monk-unarmed": (ctx) => linesOf(`Monk ${levelOf(ctx, /^monk\b/i)} unarmed damage is ${monkUnarmedDamage(levelOf(ctx, /^monk\b/i), ctx.size)}. An unarmed strike on the sheet uses that die.`),
  flurry: (ctx) => linesOf(`Flurry of blows at monk ${levelOf(ctx, /^monk\b/i)}: extra unarmed attack, all flurry attacks at −${flurryPenalty(levelOf(ctx, /^monk\b/i))}. Turn Flurry on under This round.`),
  "touch-attack": (ctx) => linesOf(`Touch AC is ${n(ctx.touchAc)}. A touch or ranged-touch weapon compares against that, not normal AC ${n(ctx.ac)}.`),
  "holding-charge": () => linesOf("A held touch charge stays until you touch a target or cast another spell. Attacking with a weapon discharges it into the weapon’s next hit."),
  fortification: (ctx, amount) => ({ formula: "1d100", lines: [`Fortification ${amount || n(ctx.fortification)}%. If the d100 is that number or less, the critical becomes a normal hit.`] }),
  "crit-immune": (ctx) => linesOf(critImmuneType(ctx.creatureType) || ctx.critImmune ? `${ctx.creatureType || "This creature"} is immune to critical hits. Confirmation is ignored.` : "No critical immunity from the creature type. Undead, constructs, elementals, oozes, and swarms are immune."),
  nonlethal: (ctx, amount) => linesOf(`Nonlethal dealt ${amount || 0}. Current nonlethal ${n(ctx.nonlethal)}. At nonlethal equal to current HP (${n(ctx.hp)}) the creature is staggered. Past that, it falls unconscious.`),
  splash: (_ctx, amount) => linesOf(`Splash weapon: direct hit takes ${amount || 1} plus the splash die. Creatures within 5 feet take the splash damage (often 1 point) and can save for none.`),
  "weapon-size": (ctx, amount) => {
    const sizes = SIZE_ORDER;
    const weapon = sizes[Math.min(SIZE_ORDER.length - 1, Math.max(0, SIZE_ORDER.indexOf(ctx.size) + (amount || 0)))] || ctx.size;
    const result = weaponSizePenalty(ctx.size, amount ? weapon : ctx.size);
    return linesOf(result.note || "Weapon size matches the wielder.");
  },
  "reach-dead": (ctx) => linesOf(`Reach ${n(ctx.reach)} ft. A reach weapon usually cannot strike adjacent squares (the 5-foot dead zone) unless it also says it can.`),
  underwater: () => linesOf("Underwater: slashing and bludgeoning take −2 attack and half damage. Piercing and natural attacks are normal. Thrown weapons do not work. An off-balance swimmer also loses Dex to AC."),
  "five-foot": (ctx) => linesOf(`A 5-foot step does not provoke if you have not moved. It is not allowed in difficult terrain or if your speed is below 10 (yours is ${n(ctx.speed)}).`),
  run: (ctx) => linesOf(`Run is ×4 speed (${n(ctx.speed) * 4} ft) in a straight line, or ×3 in heavy armor or with a heavy load. You lose your Dex bonus to AC.`),
  charge: (ctx) => linesOf(`Charge is at least 10 ft, straight, +2 attack and −2 AC. Your speed is ${n(ctx.speed)} ft. The posture select already applies the numbers.`),
  withdraw: () => linesOf("Withdraw: the first square does not provoke. Later movement does. You cannot take a 5-foot step in the same round."),
  grapple: (ctx) => ({ formula: `1d20 + ${n(ctx.grapple)}`, lines: ["Grapple check. Starting a grapple is a melee touch, then this opposed check. Pin is another grapple check. Escape is grapple or Escape Artist opposed by the grapple check."] }),
  overrun: (ctx) => ({ formula: `1d20 + ${n(ctx.str)} + ${n(ctx.sizeMod)}`, lines: ["Overrun is an opposed Strength check. The defender may dodge aside instead."] }),
  feint: (ctx) => ({ formula: `1d20 + ${skillTotal(ctx, "blf")}`, lines: ["Feint is a Bluff check opposed by Sense Motive (or BAB + Wisdom if that is better). Success denies the Dex bonus on your next attack."] }),
  "improved-trip": () => linesOf("Improved Trip: no attack of opportunity when you try to trip, and a trip drops the foe prone and gives you a free attack."),
  mounted: () => linesOf("Mounted: the mount’s action is usually a move. Mounted archery is −4 if the mount moves its speed, −8 on a run, unless you have Mounted Archery. A lance charge deals double damage."),
  "soft-cover": () => linesOf("Soft cover from an ally is +4 AC to the defender and does not let you use Precise Shot’s ignore-cover. It does not stack with other cover."),
  provoke: () => linesOf("These provoke: leaving a threatened square, ranged attacks, spells with somatic components, and standing from prone. A 5-foot step, teleport, and cease concentration do not."),
  squeeze: () => linesOf("Squeezing through a tight space costs double movement, −4 AC, and −4 on attack rolls."),
  "coup-de-grace": (ctx, amount) => linesOf(`Coup de grace hits automatically and is a critical. The target Fortitude saves DC ${10 + (amount || 0)} or dies. Your Fortitude total is ${n(ctx.fort)} if you are the one being finished.`),
  "massive-damage": (ctx, amount) => ({ formula: `1d20 + ${n(ctx.fort)}`, lines: [`Damage ${amount || 0}. If a single blow is 50 or more, Fortitude DC 15 or die.`] }),
  heal: (ctx, amount) => linesOf(`Natural healing ${naturalHealing(ctx.level, amount === 2).hp} hp and ${naturalHealing(ctx.level, amount === 2).ability} ability point(s) per day. Enter 2 in the box for long-term care.`),
  "fast-healing": (_ctx, amount) => linesOf(`Fast healing ${amount || 1}: regain that many hit points at the start of each turn. It does not restore death, ability damage, or lost limbs. Regeneration stops bleed and regrows limbs on its own schedule.`),
  restoration: () => linesOf("Lesser restoration ends ability damage and fatigue. Restoration also removes a negative level and ability drain. Raise dead restores a slain creature at −1 level. Resurrection does not cost a level."),
  poison: (_ctx, amount) => linesOf(`Poison Fortitude DC ${amount || 15}, initial and secondary (one minute later). Failure is the listed ability damage. Immunity to poison ignores both.`),
  disease: (_ctx, amount) => linesOf(`Disease Fortitude DC ${amount || 15} after the incubation period, then each day. Two successes in a row end it. Failure is the listed ability damage.`),
  "energy-drain": (ctx, amount) => linesOf(`Energy drain: ${amount || 1} negative level(s). Fortitude DC 10 + half the attacker’s HD + Cha removes one after 24 hours; otherwise it becomes level loss. Current negative levels: ${n(ctx.negativeLevels)}.`),
  dying: (ctx) => {
    const hp = n(ctx.hp);
    if (hp <= -10) return linesOf("Dead at −10 or below.");
    if (hp < 0) return linesOf(`Dying at ${hp}. Each round, 10% chance to stabilize, or lose 1 hp. A Heal check DC 15 stabilizes.`);
    if (hp === 0) return linesOf("Disabled at 0. One standard or move action, then lose 1 hp.");
    return linesOf(`Stable enough to act with ${hp} hp.`);
  },
  "energy-vulnerable": (_ctx, amount) => linesOf(`Vulnerability adds half again (+50%) of ${amount || 0} energy damage, for ${Math.floor((amount || 0) * 1.5)}. Set Vulnerable on the energy row and the attack chat does this.`),
  hardness: (_ctx, amount) => linesOf(`Object hardness ${amount || 5} is subtracted from each blow. Adamantine bypasses hardness up to 20. A door’s HP is separate from hardness.`),
  incorporeal: () => linesOf("Incorporeal: 50% miss chance against nonmagical attacks. Magic weapons have no miss chance. The Incorporeal condition notes it, and a nonmagical attack rolls the concealment die when concealment is set to 50."),
  "object-attack": () => linesOf("Objects are immune to critical hits and usually have Dex 0. Armor class is 10 minus size, or 5 if immobile. Hardness applies first."),
  "domain-slot": () => linesOf("A cleric prepares one domain spell of each level in the domain slot, in addition to the normal slots. Mark that spell prepared and do not spend a normal slot for it."),
  "forbidden-school": (ctx) => linesOf(ctx.forbidden ? `Forbidden schools: ${ctx.forbidden}. Those spells are unavailable, and the specialist’s own school is +1 DC (Spell Focus still stacks).` : "Write forbidden schools on the spellcasting notes. A specialist gives up two schools."),
  dispel: (ctx, amount) => ({ formula: `1d20 + ${n(ctx.casterLevel)}`, lines: [`Dispel check vs DC ${dispelDc(amount || 10)} (11 + the opposing caster level).`] }),
  counterspell: () => linesOf("Counterspell: ready to counter, identify the spell with Spellcraft DC 15 + spell level, then cast the same spell or dispel magic. Dispel uses the dispel check."),
  antimagic: () => linesOf("An antimagic or dead-magic area suppresses spells, magic items, and spell-like abilities inside it. Supernatural abilities usually still work. Mark the scene and do not roll those spells."),
  "somatic-grapple": () => linesOf("Casting with a somatic component while grappled requires a Concentration check DC 20 + spell level, and the spell must have no somatic component unless you succeed. Still spell removes the somatic component."),
  components: (_ctx, amount) => linesOf(`Material component cost ${amount || 0} gp is spent when the spell is cast. A divine focus is not consumed. Inexpensive components are assumed to be in a spell component pouch.`),
  summon: () => linesOf("Summon monster brings a creature from the list for that spell level. Augment Summoning adds +4 Str and Con. The creature acts on your next turn and lasts the spell’s duration."),
  "turn-destroy": (ctx, amount) => linesOf(`Turn check ${amount || 10}. Undead of at most ${turningDestructionMaxHd(n(ctx.clericLevel), amount || 10)} HD can be turned or destroyed if your level is at least twice their HD.`),
  "cleric-alignment": () => linesOf("A cleric does not cast spells of an alignment opposed to their deity or their own alignment. Good clerics do not cast evil spells, and the reverse."),
  "power-points": (ctx) => linesOf(`Suggested power points ${n(ctx.powerPoints)} (class table plus half the key ability modifier times manifester level). Current pool ${n(ctx.powerPointsCurrent)}. Use Spend and Rest on this panel.`),
  augment: (ctx, amount) => linesOf(`You may spend up to your manifester level (${n(ctx.manifesterLevel) || n(ctx.casterLevel)}) power points on one power, including the base cost. This manifestation spends ${amount || 1}.`),
  "power-resistance": (ctx) => ({ formula: `1d20 + ${n(ctx.manifesterLevel) || n(ctx.casterLevel)}`, lines: ["Power resistance is a manifester level check, like spell resistance."] }),
  "wild-surge": (ctx) => {
    const wilder = levelOf(ctx, /^wilder\b/i);
    const surge = Math.ceil(wilder / 2) || 1;
    return { formula: "1d%", lines: [`Wild surge +${surge} manifester level. Psychic enervation on a 1–${Math.min(15, surge * 5)} (d100) exhausts you for the surge’s extra points.`] };
  },
  "psi-item": (_ctx, amount) => linesOf(`A dorje holds 50 charges of a power (cost like a wand). A power stone is one use. A cognizance crystal stores ${amount || 1} power points.`),
  "encounter-el": (_ctx, amount) => linesOf(`${amount || 1} creatures of the same CR raise the encounter level by the DMG pair table. Two is +2, three +3, four +4. Put the CR in the box and read same-CR EL ${sameCrEncounter(amount || 1, 2)} for a pair, ${sameCrEncounter(amount || 1, 4)} for four.`),
  "breath-fill": (ctx) => linesOf(`Breath weapon DC ${10 + Math.floor(n(ctx.hd) / 2) + n(ctx.con)} (10 + half HD + Con). HD ${n(ctx.hd)}.`),
  "sla-uses": (_ctx, amount) => linesOf(`Spell-like ability usable ${amount || 1} time(s) per day. At-will is unlimited. Caster level is in the monster stat block, and there is no somatic failure.`),
  treasure: (_ctx, amount) => linesOf(`Treasure for CR ${amount || 1}: coins, goods, and items each have a DMG percent. A quick parcel is wealth-by-level for a party of four at that CR divided by 4, about ${Math.floor(wealthByLevel(Math.max(2, (amount || 1) + 1)) / 4)} gp of gear.`),
  template: (ctx, amount) => linesOf(halfTemplate(amount === 2 ? "fiend" : amount === 3 ? "lich" : "celestial", ctx).note + " Enter 2 for half-fiend or 3 for lich."),
  swarm: () => linesOf("A swarm is immune to critical hits, flanking, and trip, and takes half damage from slashing and piercing. It deals automatic damage to creatures inside its space."),
  "falling-object": (_ctx, amount) => linesOf(`Falling object: ${fallingObjectDice(amount || 200, 10)}d6 for ${amount || 200} lb falling 10 feet (1d6 per 200 lb, plus 1d6 per 10 feet).`),
  suffocate: (ctx) => linesOf(`Hold breath for ${suffocationRounds(ctx.conScore)} rounds (Constitution score). After that, DC 10 Fortitude, and the DC rises by 1 each round. Failure is unconscious, then dying.`),
  drown: (ctx) => linesOf(`Drowning uses the same breath count (${suffocationRounds(ctx.conScore)} rounds) and then the rising Fortitude DC.`),
  "env-damage": (_ctx, amount) => linesOf(`Environmental damage ${amount || "1d6"} per interval. Lava is 20d6 per round, immersion in acid is often 10d6, a forest fire is 1d6 per round and smoke forces Fortitude.`),
  starvation: () => linesOf("After 3 days without water, or 3 weeks without food, the creature takes 1d6 nonlethal damage each day and is fatigued. Water is the harsher clock."),
  "extreme-temp": () => linesOf("Extreme cold or heat: Fortitude DC 15 + 1 per previous check, every 10 minutes in severe conditions or each hour in milder ones. Failure is 1d4 nonlethal. Cold weather gear or endure elements skips it."),
  weather: () => linesOf("Storm winds: ranged attacks take −2, and Tiny or smaller fliers are checked. Strong wind is −4, severe −8. A tornado picks creatures up."),
  wind: (ctx) => linesOf(`Wind on flight: checked fliers move at half speed (${Math.floor(n(ctx.fly) / 2)} ft if you have a fly speed of ${n(ctx.fly)}).`),
  trap: (_ctx, amount) => linesOf(`Trap CR ${amount || 1}. A typical Search and Disable Device DC is 20 + CR (${20 + (amount || 1)}). Reflex save is often 15 + CR. Damage scales with CR, about ${amount || 1}d6.`),
  haunt: () => linesOf("A haunt is found with a Knowledge or detect undead, then a turning check or the listed attack. Destroying the anchor ends it."),
  diplomacy: (_ctx, amount) => linesOf(`Diplomacy to shift attitude. From indifferent: unfriendly DC 15 the wrong way, friendly DC 15, helpful DC 30. Hostile to unfriendly is DC 20. Enter the DC you need (${amount || 15}). A rush is −10.`),
  attitude: () => linesOf("Attitudes in order: hostile, unfriendly, indifferent, friendly, helpful. One check moves one step on a success, or two on a success by 5 or by 20 for helpful."),
  demoralize: (ctx) => ({ formula: `1d20 + ${skillTotal(ctx, "int")}`, lines: ["Demoralize: Intimidate opposed by the target’s modified level check (HD + Wisdom). Success shakes them for 1 round."] }),
  "sense-motive": (ctx) => ({ formula: `1d20 + ${skillTotal(ctx, "sen")}`, lines: [`Sense Motive ${skillTotal(ctx, "sen")} opposed by Bluff. Hunch is DC 20.`] }),
  bardic: (ctx) => linesOf(`Inspire courage +${bardicCourage(levelOf(ctx, /^bard\b/i))} morale to attack and weapon damage, and to charm saves. It lasts while you perform and 5 rounds after.`),
  research: (_ctx, amount) => linesOf(`Library research: one day and ${amount || 50} gp per Knowledge check. The DC is the knowledge DC for how obscure the fact is.`),
  training: (_ctx, amount) => linesOf(`Training a new language or a rank takes a teacher and about ${amount || 1} week. You still spend the skill point.`),
  "spell-research": (_ctx, amount) => linesOf(`Researching a new spell costs ${amount || 1000} gp and 1 day per 1,000 gp, and a Spellcraft check DC 10 + the spell level the GM sets.`),
  gems: () => linesOf("Trade goods, gems, and art sell for the listed full value in a town that wants them, or half if the buyer is a general merchant. Gems are 4d4×10 gp for a minor stone and up the DMG tables."),
  loan: (_ctx, amount) => linesOf(`A letter of credit or banked ${amount || 0} gp is tracked as treasure you do not carry. Weight is zero. A bank may charge 10% to convert it in another city.`),
  "settlement-price": (_ctx, amount) => linesOf(`Settlement availability, not a price multiplier: thorp 40% of the list, hamlet less, village and up can buy most gear. Enter a gp price (${amount || 0}) and charge the listed price when the item is in stock.`),
  "party-loot": () => linesOf("Split coins evenly. Magic items are not sold by default. The merchant actor on an NPC buys at the trade percent already on that sheet."),
  "measured-template": (_ctx, amount) => linesOf(`Spell area ${amount || 20} ft. A 20-foot radius is a 4-square radius on a 5-foot grid. Cones are a quarter-circle of that length. Lines are a 5-foot wide path.`),
  flanking: () => linesOf("Flanking: you and an ally are on opposite sides or corners of the foe, and you both threaten it. Turn the Flanking select on. The sheet does not read token positions yet."),
  "flat-footed": () => linesOf("Flat-footed until you have acted this combat. You lose your Dex bonus. Turn Flat-footed on under This round, or mark the condition."),
  "action-economy": (ctx) => linesOf(`This round you still have standard ${ctx.standard ? "yes" : "spent"}, move ${ctx.move ? "yes" : "spent"}, swift ${ctx.swift ? "yes" : "spent"}. A full-round action spends standard and move. A 5-foot step is free if you have not moved.`),
  "condition-duration": (_ctx, amount) => linesOf(`Condition duration ${amount || 1} round(s). Write it in the duration box on Status. Tick rounds on this panel when the turn ends.`),
  "spell-fail-school": (ctx) => linesOf(ctx.forbidden ? `Do not prepare ${ctx.forbidden}.` : "No forbidden schools set."),
  "epic-stop": () => linesOf("Epic levels, incarnum, Tome of Battle, and Tome of Magic are not part of this system. Add them as compendium packs if a campaign needs them."),
};

export const PROCEDURES = [
  ["Levels", "skill-points", "Skill point cost", "2 = cross-class, 4 = human 1st level"],
  ["Levels", "wealth-level", "Wealth by level", ""],
  ["Levels", "starting-gold", "Starting gold reminder", "Average gp"],
  ["Levels", "xp-award", "XP award after multiclass penalty", "XP"],
  ["Levels", "la-buyoff", "Level adjustment buyoff", "LA steps"],
  ["Levels", "hp-history", "Hit points gained this level", "HP rolled"],
  ["Levels", "racial-hd", "Racial Hit Dice", "HD"],
  ["Levels", "gestalt", "Gestalt BAB and saves", ""],
  ["Levels", "companion", "Linked companion", ""],
  ["Skills", "aid-another", "Aid another", "DC"],
  ["Skills", "opposed", "Opposed check", "Your modifier"],
  ["Skills", "take-10", "Take 10 allowed?", ""],
  ["Skills", "craft-income", "Craft income for a week", "DC"],
  ["Skills", "profession-income", "Profession income for a week", ""],
  ["Skills", "decipher", "Decipher Script", "DC"],
  ["Skills", "appraise", "Appraise", "DC"],
  ["Skills", "knowledge", "Knowledge DC", "DC"],
  ["Skills", "survival-track", "Survival, track", "DC"],
  ["Skills", "survival-wild", "Survival, wild and weather", ""],
  ["Skills", "umd", "Use Magic Device", "DC"],
  ["Skills", "jump", "Jump", "Feet"],
  ["Skills", "balance", "Balance", "DC"],
  ["Skills", "tumble", "Tumble", "DC"],
  ["Skills", "swim-dc", "Swim DCs", ""],
  ["Skills", "rope", "Use Rope", "DC"],
  ["Skills", "language", "Speak Language and literacy", ""],
  ["Skills", "retry", "Retry limits", ""],
  ["Feats", "feat-slots", "Feat slots from class and level", ""],
  ["Feats", "item-creation", "Item creation cost and time", "Base price gp"],
  ["Feats", "leadership", "Leadership cohort", "Leadership score"],
  ["Feats", "flaw", "Flaws", ""],
  ["Combat", "monk-unarmed", "Monk unarmed damage", ""],
  ["Combat", "flurry", "Flurry of blows", ""],
  ["Combat", "touch-attack", "Touch AC", ""],
  ["Combat", "holding-charge", "Holding a charge", ""],
  ["Combat", "fortification", "Fortification", "Percent"],
  ["Combat", "crit-immune", "Critical immunity", ""],
  ["Combat", "nonlethal", "Nonlethal threshold", "Damage"],
  ["Combat", "splash", "Splash weapon", "Direct damage"],
  ["Combat", "weapon-size", "Weapon size penalty", "Sizes larger"],
  ["Combat", "reach-dead", "Reach weapon dead zone", ""],
  ["Combat", "underwater", "Underwater combat", ""],
  ["Combat", "five-foot", "5-foot step", ""],
  ["Combat", "run", "Run", ""],
  ["Combat", "charge", "Charge", ""],
  ["Combat", "withdraw", "Withdraw", ""],
  ["Combat", "grapple", "Grapple check", ""],
  ["Combat", "overrun", "Overrun", ""],
  ["Combat", "feint", "Feint", ""],
  ["Combat", "improved-trip", "Improved Trip", ""],
  ["Combat", "mounted", "Mounted combat", ""],
  ["Combat", "soft-cover", "Soft cover", ""],
  ["Combat", "provoke", "What provokes", ""],
  ["Combat", "squeeze", "Squeezing", ""],
  ["Combat", "coup-de-grace", "Coup de grace", "Damage"],
  ["Combat", "massive-damage", "Massive damage", "Damage"],
  ["Combat", "heal", "Natural healing", "2 = long-term care"],
  ["Combat", "fast-healing", "Fast healing / regeneration", "Points"],
  ["Combat", "restoration", "Restoration and raise dead", ""],
  ["Combat", "poison", "Poison", "Fort DC"],
  ["Combat", "disease", "Disease", "Fort DC"],
  ["Combat", "energy-drain", "Energy drain", "Negative levels"],
  ["Combat", "dying", "Disabled, dying, dead", ""],
  ["Combat", "energy-vulnerable", "Energy vulnerability", "Damage"],
  ["Combat", "hardness", "Hardness and objects", "Hardness"],
  ["Combat", "incorporeal", "Incorporeal miss chance", ""],
  ["Combat", "object-attack", "Attacking an object", ""],
  ["Combat", "flat-footed", "Flat-footed", ""],
  ["Combat", "action-economy", "Action economy", ""],
  ["Combat", "condition-duration", "Condition duration", "Rounds"],
  ["Combat", "flanking", "Flanking", ""],
  ["Spells", "domain-slot", "Domain spell slot", ""],
  ["Spells", "forbidden-school", "Forbidden schools", ""],
  ["Spells", "dispel", "Dispel magic", "Opposing CL"],
  ["Spells", "counterspell", "Counterspell", ""],
  ["Spells", "antimagic", "Antimagic and dead magic", ""],
  ["Spells", "somatic-grapple", "Somatic components in a grapple", ""],
  ["Spells", "components", "Material components", "Gp"],
  ["Spells", "summon", "Summoned monsters", ""],
  ["Spells", "turn-destroy", "Turn or destroy undead", "Check total"],
  ["Spells", "cleric-alignment", "Cleric spell alignment", ""],
  ["Psionics", "power-points", "Power point pool", ""],
  ["Psionics", "augment", "Augment a power", "Points spent"],
  ["Psionics", "power-resistance", "Power resistance", ""],
  ["Psionics", "wild-surge", "Wild surge", ""],
  ["Psionics", "psi-item", "Dorje, stone, crystal", "Points stored"],
  ["Monsters", "encounter-el", "Encounter level", "CR"],
  ["Monsters", "breath-fill", "Breath weapon DC", ""],
  ["Monsters", "sla-uses", "Spell-like uses", "Per day"],
  ["Monsters", "treasure", "Treasure parcel", "CR"],
  ["Monsters", "template", "Half-celestial, half-fiend, lich", "2 fiend, 3 lich"],
  ["Monsters", "swarm", "Swarm traits", ""],
  ["Hazards", "falling-object", "Falling object", "Pounds"],
  ["Hazards", "suffocate", "Suffocation", ""],
  ["Hazards", "drown", "Drowning", ""],
  ["Hazards", "env-damage", "Fire, lava, acid", ""],
  ["Hazards", "starvation", "Starvation and thirst", ""],
  ["Hazards", "extreme-temp", "Extreme heat and cold", ""],
  ["Hazards", "weather", "Weather and wind", ""],
  ["Hazards", "wind", "Wind and flight", ""],
  ["Hazards", "trap", "Trap DCs", "CR"],
  ["Hazards", "haunt", "Haunt", ""],
  ["Social", "diplomacy", "Diplomacy attitude", "DC"],
  ["Social", "attitude", "Attitude steps", ""],
  ["Social", "demoralize", "Demoralize", ""],
  ["Social", "sense-motive", "Sense Motive vs Bluff", ""],
  ["Social", "bardic", "Bardic music", ""],
  ["Social", "research", "Library research", "Gp"],
  ["Social", "training", "Training time", "Weeks"],
  ["Social", "spell-research", "Spell research", "Gp"],
  ["Economy", "gems", "Gems, art, and trade goods", ""],
  ["Economy", "loan", "Letters of credit", "Gp"],
  ["Economy", "settlement-price", "Settlement availability", "Gp"],
  ["Economy", "party-loot", "Splitting loot", ""],
  ["Table", "measured-template", "Spell area on the grid", "Feet"],
  ["Table", "epic-stop", "Books this system does not automate", ""],
].map(([group, id, label, hint]) => ({ group, id, label, hint }));

export function runProcedure(id, ctx = {}, amount = 0) {
  const runner = RUNNERS[id];
  if (!runner) return { formula: null, lines: ["That procedure is not on the list."] };
  const result = runner(ctx, Number(amount) || 0);
  return { formula: result.formula || null, lines: result.lines || [] };
}
