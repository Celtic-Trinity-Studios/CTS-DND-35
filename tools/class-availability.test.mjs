import assert from "node:assert/strict";
import { evaluateClassAvailability } from "../module/helpers/progression-rules.mjs";

function check(alignment, req) {
  return evaluateClassAvailability({
    requirements: { req_alignment: req },
    actor: { system: { details: { alignment, race: "Human" } }, items: [] },
    knownFeatNames: new Set()
  });
}

const nonlawful = "neutral good, neutral, neutral evil, chaotic good, chaotic neutral, chaotic evil";
const lawful = "lawful good, lawful neutral, lawful evil";
const druid = "neutral good, lawful neutral, neutral, chaotic neutral, neutral evil";

assert.equal(check("tn", "any").ok, true);
assert.equal(check("tn", nonlawful).ok, true);
assert.equal(check("tn", druid).ok, true);
assert.equal(check("tn", lawful).ok, false);
assert.equal(check("tn", "lawful good").ok, false);
assert.equal(check("lg", "lawful good").ok, true);
assert.equal(check("lg", lawful).ok, true);
assert.equal(check("ln", nonlawful).ok, false);
assert.equal(check("", nonlawful).ok, false);

console.log("class availability tests passed");
