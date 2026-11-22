import assert from "node:assert/strict";
import {
  agingAdjustments,
  applyDamageReduction,
  breathWeaponDc,
  expandedThreat,
  experienceForCr,
  fallingDamageDice,
  halfDamage,
  multiclassXpPenalty,
  paceSpeed,
  psionPowerPoints,
  rangeIncrementPenalty,
  sellAtHalf,
  slotLoad,
  sneakDiceForClasses,
  synergyForSkill,
  xpRequiredForLevel,
  xpToReachNextLevel,
} from "../module/helpers/open-rules.mjs";

assert.equal(xpRequiredForLevel(1), 0);
assert.equal(xpRequiredForLevel(5), 10000);
assert.equal(xpToReachNextLevel(1), 1000);
assert.equal(xpToReachNextLevel(20), 210000);

assert.deepEqual(multiclassXpPenalty([{ name: "Fighter", level: 5 }, { name: "Wizard", level: 2 }], "fighter"), {
  percent: 20,
  counted: ["Wizard"],
});
assert.equal(multiclassXpPenalty([{ name: "Fighter", level: 5 }, { name: "Wizard", level: 4 }], "fighter").percent, 0);

const skills = { tmb: { ranks: 5 }, jmp: { ranks: 5 }, blf: { ranks: 4 } };
assert.equal(synergyForSkill("bal", skills).bonus, 2);
assert.equal(synergyForSkill("tmb", skills).bonus, 2);
assert.equal(synergyForSkill("dip", skills).bonus, 0);

assert.equal(expandedThreat(20, 0), 20);
assert.equal(expandedThreat(20, 1), 19);
assert.equal(expandedThreat(20, 2), 17);
assert.equal(expandedThreat(19, 1), 17);
assert.equal(rangeIncrementPenalty(1), 0);
assert.equal(rangeIncrementPenalty(3), 4);

assert.equal(sneakDiceForClasses([{ type: "class", name: "Rogue", system: { level: 1 } }]), 1);
assert.equal(sneakDiceForClasses([{ type: "class", name: "Rogue", system: { level: 7 } }]), 4);

assert.deepEqual(applyDamageReduction(12, { magic: false, dr: [{ amount: 5, bypass: "magic" }] }).amount, 7);
assert.equal(applyDamageReduction(12, { magic: true, dr: [{ amount: 5, bypass: "magic" }] }).applied, 0);
assert.equal(applyDamageReduction(12, { material: "silver", dr: [{ amount: 10, bypass: "silver" }, { amount: 5, bypass: "—" }] }).applied, 5);

assert.equal(paceSpeed(0, { armorPenalty: 10 }), 0);
assert.equal(paceSpeed(30, { armorPenalty: 10, encumberedSpeed: 20 }), 20);
assert.equal(fallingDamageDice(45), 4);
assert.equal(fallingDamageDice(300), 20);
assert.equal(breathWeaponDc(10, 3), 18);
assert.equal(halfDamage(11, true), 5);
assert.equal(sellAtHalf(15), 7.5);
assert.equal(experienceForCr("1/2"), 150);
assert.equal(experienceForCr(5), 1500);
assert.equal(psionPowerPoints(1, 2), 3);
assert.equal(psionPowerPoints(2, 2), 8);
assert.equal(psionPowerPoints(1, 2, "warrior"), 1);
assert.equal(psionPowerPoints(11, 0, "psychic warrior"), 35);
assert.equal(agingAdjustments("old").str, -2);
assert.equal(slotLoad([{ system: { equipped: true, slot: "ring" } }, { system: { equipped: true, slot: "ring" } }, { system: { equipped: true, slot: "ring" } }]).overflow.length, 1);

console.log("open-rules ok");
