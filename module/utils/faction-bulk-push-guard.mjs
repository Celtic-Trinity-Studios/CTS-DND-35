/** Suppress per-item hooks while pushing one faction to many actors (single coherent refresh at the end). */

let _depth = 0;

export function beginFactionBulkPush() {
  _depth++;
}

export function endFactionBulkPush() {
  _depth = Math.max(0, _depth - 1);
}

export function isFactionBulkPushActive() {
  return _depth > 0;
}
