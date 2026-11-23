import assert from "node:assert/strict";
import { actorForPersist } from "../module/utils/persist-actor.mjs";

const base = { id: "base", name: "ssdf" };
const world = { id: "world", isToken: false };

const deletedToken = {
  id: "ifLTe0FZErxALNuM",
  actorId: "base",
  baseActor: base,
  parent: { tokens: { get() { return undefined; } } },
};
const orphan = { isToken: true, token: deletedToken };

const liveToken = {
  id: "live",
  actorId: "base",
  baseActor: base,
  parent: null,
};
liveToken.parent = { tokens: { get(id) { return id === "live" ? liveToken : undefined; } } };
const liveSynthetic = { isToken: true, token: liveToken };

const missingBase = {
  isToken: true,
  token: {
    id: "gone",
    parent: { tokens: { get() { return undefined; } } },
  },
};

assert.equal(actorForPersist(world), world);
assert.equal(actorForPersist(orphan), base);
assert.equal(actorForPersist(liveSynthetic), liveSynthetic);
assert.equal(actorForPersist(missingBase), null);
assert.equal(actorForPersist(null), null);

console.log("persist-actor tests passed");
