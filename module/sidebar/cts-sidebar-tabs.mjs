/**
 * Extra sidebar tabs: NPCs-only actors, spells-only items, faction items only.
 * Registered on CONFIG.ui + Sidebar.TABS during init (Foundry v14 ApplicationV2 sidebar).
 */

import {
  applyActorFactionDirectoryVisualFilter,
  injectActorFactionDirectoryToolbar,
} from "../hooks/actor-faction-groups.mjs";

const ActorDirectory = foundry.applications.sidebar.tabs.ActorDirectory;
const ItemDirectory = foundry.applications.sidebar.tabs.ItemDirectory;
const Sidebar = foundry.applications.sidebar.Sidebar;

/** @param {unknown} html */
function _rootFromHtml(html) {
  if (!html) return null;
  if (html.jquery && html[0]) return html[0];
  if (html instanceof HTMLElement) return html;
  return null;
}

export class CtsNpcActorDirectory extends ActorDirectory {
  static tabName = "ctsNpcs";

  /** @type {string[]} */
  static _ctsActorTypes = ["npc"];

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

export class CtsSpellItemDirectory extends ItemDirectory {
  static tabName = "ctsSpells";

  /** @type {string[]} */
  static _ctsItemTypes = ["spell"];

  _ctsDocMatches(doc) {
    return this.constructor._ctsItemTypes.includes(doc.type);
  }

  async _postRender(context, options) {
    await super._postRender(context, options);
    this._ctsApplyItemRowVisibility();
  }

  _ctsApplyItemRowVisibility() {
    const root = this.element;
    if (!root) return;
    for (const li of root.querySelectorAll("li.directory-item[data-document-id]")) {
      const doc = game.items?.get(li.dataset.documentId);
      li.hidden = !!(doc && !this._ctsDocMatches(doc));
    }
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

export class CtsFactionItemDirectory extends ItemDirectory {
  static tabName = "ctsFactions";

  /** @type {string[]} */
  static _ctsItemTypes = ["faction"];

  _ctsDocMatches(doc) {
    return this.constructor._ctsItemTypes.includes(doc.type);
  }

  async _postRender(context, options) {
    await super._postRender(context, options);
    this._ctsApplyItemRowVisibility();
  }

  _ctsApplyItemRowVisibility() {
    const root = this.element;
    if (!root) return;
    for (const li of root.querySelectorAll("li.directory-item[data-document-id]")) {
      const doc = game.items?.get(li.dataset.documentId);
      li.hidden = !!(doc && !this._ctsDocMatches(doc));
    }
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
}
