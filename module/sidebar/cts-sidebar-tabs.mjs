/**
 * Extra sidebar tabs: NPCs-only actors, spells-only items, faction items only.
 * Registered on CONFIG.ui + Sidebar.TABS during init (Foundry v14 ApplicationV2 sidebar).
 *
 * Each tab uses a unique Application `id` / `uniqueId` so the sidebar mounts a separate panel.
 *
 * Item tabs filter by Item#type using a stylesheet rule keyed off `data-cts-item-type`. We
 * tag every rendered row from the world Items collection and let CSS (`css/cts-dnd-35.css`)
 * hide rows whose type does not match the panel. A MutationObserver keeps tagging fresh rows
 * (new items, search expansion, folder toggles, drops) so the filter does not "lose" rows.
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

/** Tag each rendered world-item row with its document type. CSS hides non-matches. */
function _tagItemRows(root) {
  if (!(root instanceof HTMLElement)) return;
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
    if (doc?.type) el.dataset.ctsItemType = doc.type;
    else el.dataset.ctsItemType = "__unknown";
  }
}

/** @type {WeakMap<HTMLElement, MutationObserver>} */
const _observers = new WeakMap();

/** Watch for added rows so the filter keeps applying after any internal re-render. */
function _ensureRowObserver(root) {
  if (!(root instanceof HTMLElement)) return;
  if (_observers.has(root)) return;
  const obs = new MutationObserver((records) => {
    let touched = false;
    for (const rec of records) {
      for (const n of rec.addedNodes) {
        if (n instanceof HTMLElement && (n.matches("[data-document-id]") || n.querySelector("[data-document-id]"))) {
          touched = true;
          break;
        }
      }
      if (touched) break;
    }
    if (touched) _tagItemRows(root);
  });
  obs.observe(root, { childList: true, subtree: true });
  _observers.set(root, obs);
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

/** Shared world-item directory filtered by Item#type via row tagging + CSS. */
class CtsTypedWorldItemDirectory extends ItemDirectory {
  /** @type {string[]} */
  static _ctsItemTypes = ["spell"];

  /** @returns {string} primary type used for the CSS attribute hook on the root */
  get _ctsPrimaryType() {
    return this.constructor._ctsItemTypes[0];
  }

  _ctsTagAndObserve() {
    const root = this.element;
    if (!root) return;
    root.dataset.ctsTypedPanel = this._ctsPrimaryType;
    _tagItemRows(root);
    _ensureRowObserver(root);
  }

  async _postRender(context, options) {
    await super._postRender(context, options);
    this._ctsTagAndObserve();
    requestAnimationFrame(() => this._ctsTagAndObserve());
  }

  /** @override */
  _onSearchFilter(event, query, rgx, html) {
    super._onSearchFilter(event, query, rgx, html);
    if (this.element) _tagItemRows(this.element);
  }

  /** @override */
  _onActivate() {
    super._onActivate?.();
    if (this.element) this._ctsTagAndObserve();
    else this.render(true);
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

function _refreshTypedTabsFromHook() {
  queueMicrotask(() => {
    requestAnimationFrame(() => {
      const tabs = [ui?.ctsSpells, ui?.ctsFactions];
      for (const tab of tabs) {
        if (!tab) continue;
        if (tab.rendered) tab.render(false);
        else if (tab.element) _tagItemRows(tab.element);
      }
    });
  });
}

function _registerWorldItemHooks() {
  const skip = (doc) => !doc || doc.isEmbedded;
  Hooks.on("createItem", (doc) => {
    if (!skip(doc)) _refreshTypedTabsFromHook();
  });
  Hooks.on("deleteItem", (doc) => {
    if (!skip(doc)) _refreshTypedTabsFromHook();
  });
  Hooks.on("updateItem", (doc) => {
    if (!skip(doc)) _refreshTypedTabsFromHook();
  });
}

function _registerRenderHooks() {
  Hooks.on("renderCtsNpcActorDirectory", (_app, html) => {
    const root = _rootFromHtml(html);
    if (!root) return;
    injectActorFactionDirectoryToolbar(root, { storageKeySuffix: "ctsNpcs" });
  });

  for (const evt of ["renderCtsSpellItemDirectory", "renderCtsFactionItemDirectory"]) {
    Hooks.on(evt, (app, html) => {
      const root = _rootFromHtml(html) ?? app?.element ?? null;
      if (!root) return;
      const primary = /** @type {typeof CtsTypedWorldItemDirectory} */ (app?.constructor)?._ctsItemTypes?.[0];
      if (primary) root.dataset.ctsTypedPanel = primary;
      _tagItemRows(root);
      _ensureRowObserver(root);
    });
  }
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
