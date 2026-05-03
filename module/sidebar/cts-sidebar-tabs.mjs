/**
 * Extra sidebar tabs: NPCs-only actors, spells-only items, faction items only.
 * Registered on CONFIG.ui + Sidebar.TABS during init (Foundry v14 ApplicationV2 sidebar).
 *
 * Each tab must use a unique Application `id` / `uniqueId` (see DEFAULT_OPTIONS). Without that,
 * subclasses still used the core `#items` / `#actors` roots and every tab showed the same panel.
 *
 * Item tabs filter at render context (`_prepareDirectoryContext`) so wrong types are not listed,
 * with a DOM pass as backup and hooks to refresh after world item changes (e.g. compendium import).
 */

import {
  applyActorFactionDirectoryVisualFilter,
  injectActorFactionDirectoryToolbar,
} from "../hooks/actor-faction-groups.mjs";

const ActorDirectory = foundry.applications.sidebar.tabs.ActorDirectory;
const ItemDirectory = foundry.applications.sidebar.tabs.ItemDirectory;
const Sidebar = foundry.applications.sidebar.Sidebar;

/**
 * @param {typeof ActorDirectory | typeof ItemDirectory} BaseCls
 * @param {string} elementId
 */
function _directoryDefaultOptions(BaseCls, elementId) {
  const base = foundry.utils.duplicate(BaseCls.DEFAULT_OPTIONS);
  return foundry.utils.mergeObject(base, { id: elementId, uniqueId: elementId });
}

/** @param {unknown} entry */
function _entryDocumentType(entry) {
  if (!entry || typeof entry !== "object") return null;
  const doc = /** @type {any} */ (entry).document ?? /** @type {any} */ (entry).doc ?? entry;
  if (doc?.documentName === "Item" || doc?.constructor?.name === "Item") return doc.type ?? null;
  return /** @type {any} */ (entry).type ?? null;
}

/**
 * Remove directory tree nodes whose document type is not allowed (world items only).
 * @param {unknown} node
 * @param {Set<string>} allow
 */
function _filterDirectoryTreeForItemTypes(node, allow) {
  if (node == null) return;
  if (Array.isArray(node)) {
    for (const el of node) _filterDirectoryTreeForItemTypes(el, allow);
    return;
  }
  if (typeof node !== "object") return;

  for (const key of ["documents", "entries", "contents"]) {
    const arr = /** @type {any} */ (node)[key];
    if (!Array.isArray(arr)) continue;
    /** @type {any} */ (node)[key] = arr.filter((e) => {
      const t = _entryDocumentType(e);
      if (t == null) return true;
      return allow.has(t);
    });
  }

  for (const key of ["tree", "children", "folders", "subfolders", "nodes", "root"]) {
    const v = /** @type {any} */ (node)[key];
    if (Array.isArray(v)) _filterDirectoryTreeForItemTypes(v, allow);
    else if (v && typeof v === "object") _filterDirectoryTreeForItemTypes(v, allow);
  }
}

/** @param {string | undefined} id */
function _worldItemFromDirectoryId(id) {
  if (!id) return null;
  let doc = game.items?.get(id) ?? null;
  if (!doc && String(id).includes(".")) {
    try {
      const resolved = foundry.utils.fromUuid(String(id));
      doc = resolved?.document ?? resolved ?? null;
    } catch {
      /* ignore */
    }
  }
  return doc?.parent ? null : doc;
}

/** @param {HTMLElement | null} root @param {string[]} types */
function _applyItemTypeRowFilter(root, types) {
  if (!root) return;
  const allow = new Set(types);
  for (const li of root.querySelectorAll("li[data-document-id]")) {
    if (li.classList.contains("folder")) continue;
    const id = li.dataset?.documentId ?? li.getAttribute("data-document-id");
    const doc = _worldItemFromDirectoryId(id ?? undefined);
    const show = !!(doc && allow.has(doc.type));
    li.style.display = show ? "" : "none";
  }
}

/** @param {unknown} html */
function _rootFromHtml(html) {
  if (!html) return null;
  if (html.jquery && html[0]) return html[0];
  if (html instanceof HTMLElement) return html;
  return null;
}

export class CtsNpcActorDirectory extends ActorDirectory {
  static tabName = "ctsNpcs";
  static DEFAULT_OPTIONS = _directoryDefaultOptions(ActorDirectory, "ctsNpcs");

  /** @type {string[]} */
  static _ctsActorTypes = ["npc"];

  get title() {
    return game.i18n.localize("CTSDND35.SidebarTabNpcs");
  }

  async _postRender(context, options) {
    await super._postRender(context, options);
    if (this.element) {
      this.element.dataset.ctsDirectoryActorType = "npc";
      applyActorFactionDirectoryVisualFilter(this.element, "");
    }
  }

  /** @override */
  _onSearchFilter(event, query, rgx, html) {
    super._onSearchFilter(event, query, rgx, html);
    const sel = this.element?.querySelector(".cts-actor-group-toolbar select.cts-actor-group-filter");
    applyActorFactionDirectoryVisualFilter(this.element, sel?.value ?? "");
  }

  /** @override */
  async _onCreateEntry(event, target) {
    const folder = target.closest("[data-folder-id]")?.dataset?.folderId ?? null;
    const Cls = CONFIG.Actor.documentClass;
    if (typeof Cls.createDialog === "function") {
      return Cls.createDialog({ folder: folder || undefined }, { types: this.constructor._ctsActorTypes });
    }
    return super._onCreateEntry(event, target);
  }
}

/** Shared world-item directory filtered by Item#type. */
class CtsTypedWorldItemDirectory extends ItemDirectory {
  /** @type {string[]} */
  static _ctsItemTypes = ["spell"];

  /** @override */
  async _prepareDirectoryContext(context, options) {
    await super._prepareDirectoryContext(context, options);
    try {
      const allow = new Set(this.constructor._ctsItemTypes);
      _filterDirectoryTreeForItemTypes(context, allow);
      _filterDirectoryTreeForItemTypes(/** @type {any} */ (context)?.directory, allow);
    } catch (err) {
      console.warn("CTS DND 35 | Typed item directory context filter failed.", err);
    }
    return context;
  }

  _ctsApplyItemRowVisibility() {
    _applyItemTypeRowFilter(this.element, this.constructor._ctsItemTypes);
  }

  async _postRender(context, options) {
    await super._postRender(context, options);
    this._ctsApplyItemRowVisibility();
    requestAnimationFrame(() => this._ctsApplyItemRowVisibility());
  }

  /** @override */
  _onSearchFilter(event, query, rgx, html) {
    super._onSearchFilter(event, query, rgx, html);
    this._ctsApplyItemRowVisibility();
  }

  /** @override */
  async _onCreateEntry(event, target) {
    const folder = target.closest("[data-folder-id]")?.dataset?.folderId ?? null;
    const Cls = CONFIG.Item.documentClass;
    if (typeof Cls.createDialog === "function") {
      return Cls.createDialog({ folder: folder || undefined }, { types: this.constructor._ctsItemTypes });
    }
    return super._onCreateEntry(event, target);
  }
}

export class CtsSpellItemDirectory extends CtsTypedWorldItemDirectory {
  static tabName = "ctsSpells";
  static DEFAULT_OPTIONS = _directoryDefaultOptions(ItemDirectory, "ctsSpells");

  /** @type {string[]} */
  static _ctsItemTypes = ["spell"];

  get title() {
    return game.i18n.localize("CTSDND35.SidebarTabSpells");
  }
}

export class CtsFactionItemDirectory extends CtsTypedWorldItemDirectory {
  static tabName = "ctsFactions";
  static DEFAULT_OPTIONS = _directoryDefaultOptions(ItemDirectory, "ctsFactions");

  /** @type {string[]} */
  static _ctsItemTypes = ["faction"];

  get title() {
    return game.i18n.localize("CTSDND35.SidebarTabFactions");
  }
}

function _mergeSidebarTabDescriptors() {
  const T = Sidebar.TABS;
  const additions = {
    ctsNpcs: {
      icon: "fas fa-dragon",
      tooltip: game.i18n.localize("CTSDND35.SidebarTabNpcs"),
    },
    ctsSpells: {
      icon: "fas fa-scroll",
      tooltip: game.i18n.localize("CTSDND35.SidebarTabSpells"),
    },
    ctsFactions: {
      icon: "fas fa-flag",
      tooltip: game.i18n.localize("CTSDND35.SidebarTabFactions"),
    },
  };
  foundry.utils.mergeObject(T, additions, { inplace: true, insertKeys: true });
}

function _registerConfigUi() {
  CONFIG.ui.ctsNpcs = CtsNpcActorDirectory;
  CONFIG.ui.ctsSpells = CtsSpellItemDirectory;
  CONFIG.ui.ctsFactions = CtsFactionItemDirectory;
}

function _queueRefreshCtsItemTabs() {
  queueMicrotask(() => {
    game.ui?.ctsSpells?.render?.(false);
    game.ui?.ctsFactions?.render?.(false);
  });
}

function _registerWorldItemHooks() {
  const skip = (doc) => !doc || doc.isEmbedded;

  Hooks.on("createItem", (doc) => {
    if (skip(doc)) return;
    _queueRefreshCtsItemTabs();
  });
  Hooks.on("deleteItem", (doc) => {
    if (skip(doc)) return;
    _queueRefreshCtsItemTabs();
  });
  Hooks.on("updateItem", (doc) => {
    if (skip(doc)) return;
    _queueRefreshCtsItemTabs();
  });
}

function _registerRenderHooks() {
  Hooks.on("renderCtsNpcActorDirectory", (_app, html) => {
    const root = _rootFromHtml(html);
    if (!root) return;
    injectActorFactionDirectoryToolbar(root, { storageKeySuffix: "ctsNpcs" });
  });
}

/** Call from `Hooks.once("init")` before the UI is constructed. */
export function registerCtsSidebarTabs() {
  if (!foundry?.applications?.sidebar?.Sidebar?.TABS) {
    console.warn("CTS DND 35 | Sidebar.TABS unavailable; CTS sidebar tabs not registered.");
    return;
  }
  _mergeSidebarTabDescriptors();
  _registerConfigUi();
  _registerRenderHooks();
  _registerWorldItemHooks();
}
