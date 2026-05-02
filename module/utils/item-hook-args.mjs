/**
 * Foundry dispatches some Item hooks with different argument shapes:
 * - World / compendium items: (item, …)
 * - Embedded items on an Actor: often (parentActor, item, …)
 */

/** @returns {{ item: foundry.documents.Item | null, actor: foundry.documents.Actor | null }} */
export function getItemAndActorFromHookArgs(first, second) {
  if (!first) return { item: null, actor: null };
  if (first.documentName === "Item") {
    const item = first;
    const actor =
      item.actor ?? (item.parent?.documentName === "Actor" ? item.parent : null);
    return { item, actor };
  }
  if (first.documentName === "Actor" && second?.documentName === "Item") {
    return { item: second, actor: first };
  }
  return { item: null, actor: null };
}

/**
 * @returns {{ item: foundry.documents.Item | null, actor: foundry.documents.Actor | null, changed: object }}
 */
export function getUpdateItemHookContext(first, second, third) {
  const { item, actor } = getItemAndActorFromHookArgs(first, second);
  let changed = {};
  if (first?.documentName === "Item") changed = second && typeof second === "object" ? second : {};
  else if (first?.documentName === "Actor" && second?.documentName === "Item") {
    changed = third && typeof third === "object" ? third : {};
  }
  return { item, actor, changed };
}
