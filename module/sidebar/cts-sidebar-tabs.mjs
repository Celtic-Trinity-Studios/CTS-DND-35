/**
 * Extra sidebar tabs: NPCs-only actors, spells-only items, faction items only.
 * Registered on CONFIG.ui + Sidebar.TABS during init (Foundry v14 ApplicationV2 sidebar).
 *
 * Each tab must use a unique Application `id` / `uniqueId` (see DEFAULT_OPTIONS). Without that,
 * subclasses still used the core `#items` / `#actors` roots and every tab showed the same panel.
 *
 * Typed item tabs filter by Item#type in the DOM after each render. We do not mutate
 * `_prepareDirectoryContext` trees — that broke v14 directory data (e.g. factions never listing).
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

/** @param {string | null | undefined} id */
function _resolveWorldItemByDirectoryId(id) {
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

/** @param {HTMLElement | null} root @param {string[]} types */
function _applyItemTypeRowFilter(root, types) {
  if (!root) return;
  const allow = new Set(types);
  const nodes = root.querySelectorAll("[data-document-id]");
  for (const el of nodes) {
    if (!(el instanceof HTMLElement)) continue;
    if (el.classList.contains("folder")) continue;
    const id =
      el.dataset?.documentId ??
      el.getAttribute("data-document-id") ??
      el.dataset?.entryId ??
      el.getAttribute("data-entry-id");
    const doc = _resolveWorldItemByDirectoryId(id ?? undefined);
    const show = !!(doc && allow.has(doc.type));
    el.style.display = show ? "" : "none";
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

/** Shared world-item directory filtered by Item#type (DOM only). */
class CtsTypedWorldItemDirectory extends ItemDirectory {
  /** @type {string[]} */
  static _ctsItemTypes = ["spell"];

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
    requestAnimationFrame(() => {
      game.ui?.ctsSpells?.render?.(false);
      game.ui?.ctsFactions?.render?.(false);
    });
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

function _typedItemRowHook(app, html) {
  const root = _rootFromHtml(html) ?? app?.element ?? null;
  const types = /** @type {typeof CtsTypedWorldItemDirectory} */ (app?.constructor)?._ctsItemTypes;
  if (root && types) _applyItemTypeRowFilter(root, types);
}

function _registerRenderHooks() {
  Hooks.on("renderCtsNpcActorDirectory", (_app, html) => {
    const root = _rootFromHtml(html);
    if (!root) return;
    injectActorFactionDirectoryToolbar(root, { storageKeySuffix: "ctsNpcs" });
  });

  Hooks.on("renderCtsSpellItemDirectory", (app, html) => {
    queueMicrotask(() => _typedItemRowHook(app, html));
  });
  Hooks.on("renderCtsFactionItemDirectory", (app, html) => {
    queueMicrotask(() => _typedItemRowHook(app, html));
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
