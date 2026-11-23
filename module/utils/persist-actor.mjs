/**
 * Where actor edits should be written.
 * A synthetic token actor whose token is still on the scene is saved in place.
 * If that token was deleted, writes go to the world actor instead of the missing token.
 * @param {object | null | undefined} actor
 * @returns {object | null}
 */
export function actorForPersist(actor) {
  if (!actor) return null;
  if (!actor.isToken) return actor;

  const token = actor.token ?? null;
  const live = !!(token?.id && token.parent?.tokens?.get?.(token.id));
  if (live) return actor;

  return token?.baseActor ?? globalThis.game?.actors?.get?.(token?.actorId) ?? null;
}
