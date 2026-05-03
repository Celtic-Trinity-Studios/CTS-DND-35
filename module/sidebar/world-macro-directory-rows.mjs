import { DIRECTORY_ROW_SELECTOR } from "./world-item-directory-rows.mjs";

/** @param {string | null | undefined} id */
export function resolveWorldMacroFromDirectoryId(id) {
  if (!id) return null;
  const col = game.macros;
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
  if (!doc) return null;
  return doc;
}

export function tagWorldMacroDirectoryRows(root) {
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
    const doc = resolveWorldMacroFromDirectoryId(id ?? undefined);
    if (doc?.type) el.dataset.ctsMacroType = doc.type;
    else el.dataset.ctsMacroType = "__unknown";
  }
}
