/**
 * Extra sidebar tabs: NPCs-only actors, spells-only items, faction items only.
 * Registered on CONFIG.ui + Sidebar.TABS during init (Foundry v14 ApplicationV2 sidebar).
 *
 * Each tab uses a unique Application `id` / `uniqueId` so the sidebar mounts a separate panel.
 *
 * Item tabs filter by Item#type using a stylesheet rule keyed off `data-cts-item-type`. We
 * tag every rendered row from the world Items collection (`world-item-directory-rows.mjs`) and
 * let CSS (`css/cts-dnd-35.css`) hide rows whose type does not match the panel. A MutationObserver
 * keeps tagging fresh rows (new items, search expansion, folder toggles, drops) so the filter
 * does not "lose" rows. The main Items tab can add a vertical type rail (`items-directory-type-rail.mjs`).
 */

import {
  applyActorFactionDirectoryVisualFilter,
  injectActorFactionDirectoryToolbar,
} from "../hooks/actor-faction-groups.mjs";
import {
  DIRECTORY_ROW_SELECTOR,
  resolveWorldItemFromDirectoryId,
  tagWorldItemDirectoryRows,
} from "./world-item-directory-rows.mjs";
import { registerItemsDirectoryTypeRail } from "./items-directory-type-rail.mjs";

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

/**
 * Print diagnostic data about a typed sidebar panel render.
 * Enabled by `game.settings.get("CTS-DND-35", "sidebarDiagnostics")`.
 * @param {Application} app
 * @param {HTMLElement} root
 * @param {string} primary
 */
function _logTypedPanelDiagnostics(app, root, primary) {
  try {
    if (!game.settings?.get?.("CTS-DND-35", "sidebarDiagnostics")) return;
  } catch {
    return;
  }
  const nodesEntry = root.querySelectorAll("[data-entry-id]");
  const nodesDoc = root.querySelectorAll("[data-document-id]");
  const nodes = root.querySelectorAll(DIRECTORY_ROW_SELECTOR);
  const liNodes = root.querySelectorAll("li");
  const directoryItems = root.querySelectorAll("li.directory-item, .directory-item");
  const sampleRow = nodes[0] ?? directoryItems[0] ?? null;
  /** @type {Record<string, unknown>} */
  const sampleAttrs = {};
  if (sampleRow instanceof HTMLElement) {
    for (const attr of sampleRow.attributes) sampleAttrs[attr.name] = attr.value;
  }
  const rowSummary = [];
  let limit = Math.min(nodes.length, 8);
  for (let i = 0; i < limit; i++) {
    const el = nodes[i];
    if (!(el instanceof HTMLElement)) continue;
    const id =
      el.dataset?.entryId ??
      el.getAttribute("data-entry-id") ??
      el.dataset?.documentId ??
      el.getAttribute("data-document-id");
    const doc = resolveWorldItemFromDirectoryId(id ?? undefined);
    rowSummary.push({
      tag: el.tagName.toLowerCase(),
      classes: el.className,
      "data-entry-id": el.dataset?.entryId ?? el.getAttribute("data-entry-id") ?? null,
      "data-document-id": el.dataset?.documentId ?? el.getAttribute("data-document-id") ?? null,
      "data-cts-item-type": el.dataset.ctsItemType ?? null,
      resolvedType: doc?.type ?? null,
      resolvedName: doc?.name ?? null,
      isEmbedded: doc?.isEmbedded ?? null,
      collectionKey: doc?.collection?.collectionName ?? null,
    });
  }
  console.groupCollapsed(`CTS DND 3.5 | sidebar diagnostic [${primary}]`);
  console.log("app:", app?.constructor?.name, "id:", app?.id, "tabName:", app?.tabName);
  console.log("root id:", root.id, "data-cts-typed-panel:", root.dataset.ctsTypedPanel);
  console.log("counts:", {
    "[data-entry-id]": nodesEntry.length,
    "[data-document-id]": nodesDoc.length,
    directoryRows: nodes.length,
    li: liNodes.length,
    "directory-item": directoryItems.length,
    worldItems: game.items?.size ?? null,
    factionWorldItems: [...(game.items ?? [])].filter((d) => d.type === "faction").length,
    spellWorldItems: [...(game.items ?? [])].filter((d) => d.type === "spell").length,
  });
  console.log("sampleRow attrs:", sampleAttrs);
  console.table(rowSummary);
  if (sampleRow instanceof HTMLElement) console.log("sampleRow HTML:", sampleRow.outerHTML.slice(0, 400));
  console.groupEnd();
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
        if (
          n instanceof HTMLElement &&
          (n.matches("[data-entry-id], [data-document-id]") ||
            n.querySelector("[data-entry-id], [data-document-id]"))
        ) {
          touched = true;
          break;
        }
      }
      if (touched) break;
    }
    if (touched) tagWorldItemDirectoryRows(root);
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
    tagWorldItemDirectoryRows(root);
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
    if (this.element) tagWorldItemDirectoryRows(this.element);
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
        else if (tab.element) tagWorldItemDirectoryRows(tab.element);
      }
      if (ui?.items?.element) tagWorldItemDirectoryRows(ui.items.element);
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
      tagWorldItemDirectoryRows(root);
      _ensureRowObserver(root);
      if (primary) _logTypedPanelDiagnostics(app, root, primary);
    });
  }
}

function _registerSidebarDiagnosticSetting() {
  game.settings.register("CTS-DND-35", "sidebarDiagnostics", {
    name: game.i18n.localize("CTSDND35.SidebarDiagnosticsName") || "CTS sidebar diagnostics",
    hint:
      game.i18n.localize("CTSDND35.SidebarDiagnosticsHint") ||
      "Log details about the NPC / Spells / Factions sidebar panels to the browser console (F12) on each render. Turn off when the filter is verified working.",
    scope: "client",
    config: true,
    type: Boolean,
    default: false,
  });
}

/** Call from `Hooks.once("init")` before the UI is constructed. */
export function registerCtsSidebarTabs() {
  if (!foundry?.applications?.sidebar?.Sidebar?.TABS) {
    console.warn("CTS DND 3.5 | Sidebar.TABS unavailable; CTS sidebar tabs not registered.");
    return;
  }
  _mergeSidebarTabDescriptors();
  _registerConfigUi();
  _registerSidebarDiagnosticSetting();
  _registerRenderHooks();
  _registerWorldItemHooks();
  registerItemsDirectoryTypeRail();
}
