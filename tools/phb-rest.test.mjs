import assert from "node:assert/strict";
import {
  PROCEDURES,
  bardicCourage,
  bonusPowerPoints,
  dispelDc,
  fallingObjectDice,
  fighterBonusFeats,
  flurryPenalty,
  itemCreation,
  monkUnarmedDamage,
  naturalHealing,
  runProcedure,
  sameCrEncounter,
  skillTypedBonus,
  weaponSizePenalty,
  wealthByLevel,
} from "../module/helpers/phb-rest.mjs";

assert.equal(monkUnarmedDamage(1, "med"), "1d6");
assert.equal(monkUnarmedDamage(8, "med"), "1d10");
assert.equal(monkUnarmedDamage(20, "sm"), "2d8");
assert.equal(flurryPenalty(1), 2);
assert.equal(flurryPenalty(9), 0);
assert.equal(weaponSizePenalty("med", "lg").penalty, 2);
assert.equal(skillTypedBonus({ circumstance: 2, competence: 3, insight: 1 }).total, 6);
assert.equal(skillTypedBonus({ circumstance: 1, masterwork: true }).total, 2);
assert.equal(wealthByLevel(5), 9000);
assert.equal(itemCreation(1000).xp, 40);
assert.equal(fighterBonusFeats(1), 1);
assert.equal(fighterBonusFeats(2), 2);
assert.equal(bonusPowerPoints(2, 1), 1);
assert.equal(bonusPowerPoints(2, 2), 2);
assert.equal(dispelDc(5), 16);
assert.equal(naturalHealing(4, true).hp, 8);
assert.equal(fallingObjectDice(400, 20), 4);
assert.equal(sameCrEncounter(5, 4), 9);
assert.equal(bardicCourage(8), 2);
assert.equal(runProcedure("dying", { hp: -3 }).lines[0].includes("Dying"), true);
assert.equal(runProcedure("nope").lines.length, 1);
assert.ok(PROCEDURES.length > 80);

console.log("phb-rest ok", PROCEDURES.length);
