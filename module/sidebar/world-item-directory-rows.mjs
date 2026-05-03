/**
 * Shared helpers for world Item directory rows (Foundry v14 uses data-entry-id).
 */

/** Foundry v14+ directory rows use `data-entry-id`; older builds used `data-document-id`. */
export const DIRECTORY_ROW_SELECTOR =
  "li.directory-item[data-entry-id], li.directory-item[data-document-id], .directory-item[data-entry-id], .directory-item[data-document-id]";

/** @param {string | null | undefined} id */
export function resolveWorldItemFromDirectoryId(id) {
  if (!id) return null;
  const col = game.items;
  if (!col) return null;
  let doc = col.get(id) ?? null;
  if (!doc && typeof col.find === "function") {
    doc = col.find((d) => d.id === id || d.uuid === id);
  }
  if (!doc && String(id).includes(".")) {
    try {
      const resolved = foundry.utils.fromUuid(String(id));
      doc = resolved?.document ?? resolved ?? null;
    } catch {
      /* ignore */
    }
  }
  if (!doc || doc.isEmbedded) return null;
  return doc;
}

/** Tag each rendered world-item row with `data-cts-item-type` for CSS filtering. */
export function tagWorldItemDirectoryRows(root) {
  if (!(root instanceof HTMLElement)) return;
  const nodes = root.querySelectorAll(DIRECTORY_ROW_SELECTOR);
  for (const el of nodes) {
    if (!(el instanceof HTMLElement)) continue;
    if (el.classList.contains("folder")) continue;
    const id =
      el.dataset?.entryId ??
      el.getAttribute("data-entry-id") ??
      el.dataset?.documentId ??
      el.getAttribute("data-document-id");
    const doc = resolveWorldItemFromDirectoryId(id ?? undefined);
    if (doc?.type) el.dataset.ctsItemType = doc.type;
    else el.dataset.ctsItemType = "__unknown";
  }
}
