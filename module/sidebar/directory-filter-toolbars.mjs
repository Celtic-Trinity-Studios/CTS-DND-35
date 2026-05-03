/**
 * Directory filter toolbars (right sidebar): one consolidated, brute-force implementation.
 *
 * Strategy:
 *   1. Register render hooks for all four directories.
 *   2. Also poll the DOM every 750ms for the first 30s after page load (and on-demand).
 *      Whatever fires first wins; the inject function is idempotent (guards on a marker class).
 *   3. Always inject — no setting gate. If the user wants to disable, they remove the
 *      module/system. We can re-introduce a toggle once everyone confirms it works.
 *
 * Each panel uses a dedicated config in TOOLBAR_DEFS.
 */

import { tagWorldItemDirectoryRows } from "./world-item-directory-rows.mjs";
import { tagWorldActorDirectoryRows } from "./world-actor-directory-rows.mjs";
import { tagWorldMacroDirectoryRows } from "./world-macro-directory-rows.mjs";
import { tagWorldSceneDirectoryRows } from "./world-scene-directory-rows.mjs";
import { DIRECTORY_ROW_SELECTOR } from "./world-item-directory-rows.mjs";
import { applyActorFactionDirectoryVisualFilter } from "../hooks/actor-faction-groups.mjs";

const LOG = "CTS sidebar |";
const FILTER_STYLE_ID = "cts-directory-filter-css";

/** @type {WeakMap<HTMLElement, MutationObserver>} */
const rowObservers = new WeakMap();

function log(...args) {
  try {
    console.log(LOG, ...args);
  } catch {
    /* ignore */
  }
}

function escapeIdent(v) {
  if (!v || !/^[a-z0-9_-]+$/i.test(v)) return "";
  return v;
}

function titleCase(s) {
  if (typeof foundry?.utils?.titleCase === "function") return foundry.utils.titleCase(s);
  return String(s).replace(/\b\w/g, (c) => c.toUpperCase());
}

function localize(key, fallback) {
  try {
    const v = game.i18n?.localize?.(key);
    if (v && v !== key) return v;
  } catch {
    /* ignore */
  }
  return fallback;
}

/* ------------------------------------------------------------------ */
/* Filter style sheet                                                  */
/* ------------------------------------------------------------------ */

function ensureStyleSheet() {
  let style = document.getElementById(FILTER_STYLE_ID);
  if (!style) {
    style = document.createElement("style");
    style.id = FILTER_STYLE_ID;
    document.head.appendChild(style);
  }
  return style;
}

/**
 * Each row selector branch must be scoped under the host (commas would otherwise leave the
 * later branches global and either hide nothing or hide rows in the wrong panels).
 * @param {string} hostSelector e.g. `.cts-host-items[data-cts-filter="weapon"]`
 * @param {string} rowAttr      e.g. `data-cts-item-type`
 * @param {string} value        the active filter value (CSS-safe)
 */
function buildHideRules(hostSelector, rowAttr, value) {
  return DIRECTORY_ROW_SELECTOR.split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(
      (sel) =>
        `${hostSelector} ${sel}:not(.folder):not([${rowAttr}="${value}"]) { display: none !important; }`
    )
    .join("\n");
}

/* ------------------------------------------------------------------ */
/* Toolbar definitions                                                 */
/* ------------------------------------------------------------------ */

const TOOLBAR_DEFS = [
  {
    kind: "items",
    storageKey: "CTS-DND-35.itemsDirectoryTypeFilter",
    hostClass: "cts-host-items",
    filterAttr: "data-cts-items-filter",
    rowAttr: "data-cts-item-type",
    uiKey: "items",
    appPropName: "items",
    constructorName: "ItemDirectory",
    tabName: "items",
    collectionGetter: () => game.items,
    rowTagger: tagWorldItemDirectoryRows,
    typeProvider: () => {
      const raw = game.system?.documentTypes?.Item;
      let list = [];
      if (Array.isArray(raw)) list = raw.map(String);
      else if (raw && typeof raw === "object") list = Object.keys(raw);
      else if (CONFIG.Item?.typeLabels && typeof CONFIG.Item.typeLabels === "object") list = Object.keys(CONFIG.Item.typeLabels);
      return list.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
    },
    labelProvider: (t) => {
      const tl = CONFIG.Item?.typeLabels?.[t];
      const fromCfg = tl ? localize(tl, "") : "";
      if (fromCfg) return fromCfg;
      return localize(`CTSDND35.ItemType${t.charAt(0).toUpperCase()}${t.slice(1)}`, titleCase(t));
    },
    extraApplyToRoot: () => {},
  },
  {
    kind: "actors",
    storageKey: "CTS-DND-35.actorDirectoryTypeFilter",
    hostClass: "cts-host-actors",
    filterAttr: "data-cts-actors-filter",
    rowAttr: "data-cts-actor-type",
    uiKey: "actors",
    appPropName: "actors",
    constructorName: "ActorDirectory",
    tabName: "actors",
    collectionGetter: () => game.actors,
    rowTagger: tagWorldActorDirectoryRows,
    typeProvider: () => {
      const raw = game.system?.documentTypes?.Actor;
      let list = [];
      if (Array.isArray(raw)) list = raw.map(String);
      else if (raw && typeof raw === "object") list = Object.keys(raw);
      else if (CONFIG.Actor?.typeLabels && typeof CONFIG.Actor.typeLabels === "object") list = Object.keys(CONFIG.Actor.typeLabels);
      return list.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
    },
    labelProvider: (t) => {
      const tl = CONFIG.Actor?.typeLabels?.[t];
      const fromCfg = tl ? localize(tl, "") : "";
      if (fromCfg) return fromCfg;
      return localize(`CTSDND35.ActorType${t.charAt(0).toUpperCase()}${t.slice(1)}`, titleCase(t));
    },
    extraApplyToRoot: (root, value) => {
      if (value) root.dataset.ctsDirectoryActorType = value;
      else delete root.dataset.ctsDirectoryActorType;
      const sel = root.querySelector(".cts-actor-group-toolbar select.cts-actor-group-filter");
      try {
        applyActorFactionDirectoryVisualFilter(root, sel?.value ?? "");
      } catch {
        /* ignore */
      }
    },
  },
  {
    kind: "macros",
    storageKey: "CTS-DND-35.macrosDirectoryTypeFilter",
    hostClass: "cts-host-macros",
    filterAttr: "data-cts-macros-filter",
    rowAttr: "data-cts-macro-type",
    uiKey: "macros",
    appPropName: "macros",
    constructorName: "MacroDirectory",
    tabName: "macros",
    collectionGetter: () => game.macros,
    rowTagger: tagWorldMacroDirectoryRows,
    typeProvider: () => {
      const T = CONST?.MACRO_TYPES;
      if (T && typeof T === "object" && !Array.isArray(T)) {
        return Object.values(T)
          .map((v) => String(v))
          .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
      }
      return ["chat", "script"];
    },
    labelProvider: (t) =>
      localize(`CTSDND35.MacroType${t.charAt(0).toUpperCase()}${t.slice(1)}`, titleCase(t)),
    extraApplyToRoot: () => {},
  },
];

/* ------------------------------------------------------------------ */
/* DOM helpers                                                         */
/* ------------------------------------------------------------------ */

function findDirectoryRoot(def) {
  /* Try the live ui object first (most reliable) */
  const ui = globalThis.ui;
  const app = ui?.[def.appPropName];
  const fromApp = app?.element;
  if (fromApp instanceof HTMLElement && fromApp.isConnected) return fromApp;

  /* Foundry v14 ApplicationV2 ids: tabs render with id="<tabName>" inside #sidebar */
  const byId = document.getElementById(def.tabName);
  if (byId instanceof HTMLElement && byId.isConnected && byId.closest("#sidebar")) return byId;

  /* data-tab attribute on the sidebar tab (legacy + most v14 builds) */
  const byTab = document.querySelector(`#sidebar [data-tab="${def.tabName}"]`);
  if (byTab instanceof HTMLElement && byTab.isConnected) return byTab;

  /* application-id attribute (some v14 builds) */
  const byAppId = document.querySelector(`#sidebar [data-application-id*="${def.tabName}"]`);
  if (byAppId instanceof HTMLElement && byAppId.isConnected) return byAppId;

  /* Last resort: any element with .directory-list inside #sidebar that contains rows of the right type */
  if (def.tabName === "items") {
    const lists = document.querySelectorAll("#sidebar section, #sidebar .tab");
    for (const el of lists) {
      if (el.querySelector('[data-entry-id], [data-document-id]') &&
          (el.id === "items" || el.getAttribute("data-tab") === "items")) {
        return el;
      }
    }
  }

  return null;
}

function applyFilterCss(def, value) {
  const safe = escapeIdent(value);
  const style = ensureStyleSheet();
  /* Recompute the entire stylesheet from current state of all defs */
  const rules = [];
  for (const d of TOOLBAR_DEFS) {
    const root = findDirectoryRoot(d);
    if (!(root instanceof HTMLElement)) continue;
    if (d === def) {
      if (safe) rules.push(buildHideRules(`.${d.hostClass}[${d.filterAttr}="${safe}"]`, d.rowAttr, safe));
    } else if (root.dataset[`cts${capitalize(d.kind)}Filter`]) {
      const v = root.dataset[`cts${capitalize(d.kind)}Filter`];
      if (escapeIdent(v)) rules.push(buildHideRules(`.${d.hostClass}[${d.filterAttr}="${v}"]`, d.rowAttr, v));
    }
  }
  /* Scenes uses a special data-cts-scene-nav approach below; not in TOOLBAR_DEFS */
  rules.push(buildScenesNavRules());
  style.textContent = rules.filter(Boolean).join("\n");
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ------------------------------------------------------------------ */
/* Scenes (special: filters by navigation flag, not a "type")           */
/* ------------------------------------------------------------------ */

const SCENES_STATE = {
  storageKey: "CTS-DND-35.scenesDirectoryNavFilter",
  hostClass: "cts-host-scenes",
  filterAttr: "data-cts-scenes-nav-filter",
  rowAttr: "data-cts-scene-nav",
  uiKey: "scenes",
  appPropName: "scenes",
  constructorName: "SceneDirectory",
  tabName: "scenes",
  rowTagger: tagWorldSceneDirectoryRows,
  kind: "scenes",
};

function buildScenesNavRules() {
  const root = findDirectoryRoot(SCENES_STATE);
  if (!(root instanceof HTMLElement)) return "";
  const mode = root.getAttribute(SCENES_STATE.filterAttr);
  if (mode !== "nav" && mode !== "nonav") return "";
  const target = mode === "nav" ? "true" : "false";
  return DIRECTORY_ROW_SELECTOR.split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(
      (sel) =>
        `.${SCENES_STATE.hostClass}[${SCENES_STATE.filterAttr}="${mode}"] ${sel}:not(.folder):not([${SCENES_STATE.rowAttr}="${target}"]) { display: none !important; }`
    )
    .join("\n");
}

/* ------------------------------------------------------------------ */
/* Toolbar build / inject                                              */
/* ------------------------------------------------------------------ */

function readStored(storageKey) {
  try {
    return sessionStorage.getItem(storageKey) ?? "";
  } catch {
    return "";
  }
}

function writeStored(storageKey, value) {
  try {
    if (!value) sessionStorage.removeItem(storageKey);
    else sessionStorage.setItem(storageKey, value);
  } catch {
    /* ignore */
  }
}

function ensureRowObserver(root, tagger) {
  if (rowObservers.has(root)) return;
  const obs = new MutationObserver(() => {
    try {
      tagger(root);
    } catch {
      /* ignore */
    }
  });
  obs.observe(root, { childList: true, subtree: true });
  rowObservers.set(root, obs);
}

function applyTypedFilter(def, root, value) {
  root.classList.add(def.hostClass);
  const safe = escapeIdent(value);
  if (safe) root.setAttribute(def.filterAttr, safe);
  else root.removeAttribute(def.filterAttr);
  writeStored(def.storageKey, safe);
  try {
    def.rowTagger?.(root);
  } catch {
    /* ignore */
  }
  applyFilterCss(def, safe);
  try {
    def.extraApplyToRoot?.(root, safe);
  } catch {
    /* ignore */
  }
}

function applyScenesNavFilter(root, mode) {
  root.classList.add(SCENES_STATE.hostClass);
  if (mode === "nav" || mode === "nonav") root.setAttribute(SCENES_STATE.filterAttr, mode);
  else root.removeAttribute(SCENES_STATE.filterAttr);
  writeStored(SCENES_STATE.storageKey, mode === "nav" || mode === "nonav" ? mode : "");
  try {
    SCENES_STATE.rowTagger?.(root);
  } catch {
    /* ignore */
  }
  /* Recompute styles */
  applyFilterCss(TOOLBAR_DEFS[0], readStored(TOOLBAR_DEFS[0].storageKey));
}

function syncToolbarActive(toolbar, value, getValueFromBtn) {
  const safe = escapeIdent(value);
  for (const btn of toolbar.querySelectorAll("button.cts-items-rail-btn")) {
    const isAll = btn.classList.contains("cts-items-rail-btn--all");
    const v = isAll ? "" : (getValueFromBtn(btn) ?? "");
    btn.classList.toggle("active", isAll ? !safe : v === safe);
  }
}

function makeButton({ active, label, dataAttr, dataValue, isAll, title }) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = `cts-items-rail-btn${isAll ? " cts-items-rail-btn--all" : ""}${active ? " active" : ""}`;
  b.setAttribute("role", "tab");
  if (dataAttr && !isAll) b.setAttribute(dataAttr, dataValue);
  b.title = title ?? label;
  b.textContent = label;
  return b;
}

function buildTypedToolbar(def) {
  const types = def.typeProvider();
  if (types.length < 1) return null;
  const stored = readStored(def.storageKey);
  const nav = document.createElement("nav");
  nav.className = "cts-items-type-toolbar";
  nav.dataset.ctsToolbarKind = def.kind;
  nav.setAttribute("role", "tablist");

  const allLabel = localize("CTSDND35.ItemsRailAll", "All types");
  nav.appendChild(makeButton({ active: !stored, label: allLabel, isAll: true }));

  for (const t of types) {
    const label = def.labelProvider(t);
    nav.appendChild(
      makeButton({
        active: stored === t,
        label,
        dataAttr: def.rowAttr,
        dataValue: t,
        isAll: false,
      })
    );
  }
  return nav;
}

function buildScenesToolbar() {
  const stored = readStored(SCENES_STATE.storageKey);
  const nav = document.createElement("nav");
  nav.className = "cts-items-type-toolbar";
  nav.dataset.ctsToolbarKind = "scenes";
  nav.setAttribute("role", "tablist");

  nav.appendChild(makeButton({ active: !stored, label: localize("CTSDND35.ItemsRailAll", "All types"), isAll: true }));
  nav.appendChild(
    makeButton({
      active: stored === "nav",
      label: localize("CTSDND35.SceneFilterNav", "Nav bar"),
      title: localize("CTSDND35.SceneFilterNavHint", "Show only scenes on the navigation bar"),
      dataAttr: "data-cts-scene-nav-mode",
      dataValue: "nav",
      isAll: false,
    })
  );
  nav.appendChild(
    makeButton({
      active: stored === "nonav",
      label: localize("CTSDND35.SceneFilterNonNav", "Not on bar"),
      title: localize("CTSDND35.SceneFilterNonNavHint", "Show only scenes not on the navigation bar"),
      dataAttr: "data-cts-scene-nav-mode",
      dataValue: "nonav",
      isAll: false,
    })
  );
  return nav;
}

function injectTypedToolbar(def) {
  const root = findDirectoryRoot(def);
  if (!(root instanceof HTMLElement)) return false;
  if (root.querySelector(`.cts-items-type-toolbar[data-cts-toolbar-kind='${def.kind}']`)) return true;

  const toolbar = buildTypedToolbar(def);
  if (!toolbar) return false;
  toolbar.addEventListener("click", (ev) => {
    const btn = ev.target?.closest?.("button.cts-items-rail-btn");
    if (!(btn instanceof HTMLButtonElement)) return;
    ev.preventDefault();
    ev.stopPropagation();
    let value = "";
    if (!btn.classList.contains("cts-items-rail-btn--all")) {
      value = btn.getAttribute(def.rowAttr) ?? "";
    }
    applyTypedFilter(def, root, value);
    syncToolbarActive(toolbar, value, (b) => b.getAttribute(def.rowAttr));
  });

  const sidebar = root.querySelector(".directory-sidebar");
  const anchor = sidebar instanceof HTMLElement ? sidebar : root;
  anchor.insertAdjacentElement("afterbegin", toolbar);

  const stored = readStored(def.storageKey);
  applyTypedFilter(def, root, stored);
  syncToolbarActive(toolbar, stored, (b) => b.getAttribute(def.rowAttr));
  ensureRowObserver(root, def.rowTagger);

  log(`mounted [${def.kind}] toolbar`, { types: def.typeProvider().length, stored });
  return true;
}

function injectScenesToolbar() {
  const root = findDirectoryRoot(SCENES_STATE);
  if (!(root instanceof HTMLElement)) return false;
  if (root.querySelector(`.cts-items-type-toolbar[data-cts-toolbar-kind='scenes']`)) return true;

  const toolbar = buildScenesToolbar();
  toolbar.addEventListener("click", (ev) => {
    const btn = ev.target?.closest?.("button.cts-items-rail-btn");
    if (!(btn instanceof HTMLButtonElement)) return;
    ev.preventDefault();
    ev.stopPropagation();
    let mode = "";
    if (!btn.classList.contains("cts-items-rail-btn--all")) {
      mode = btn.getAttribute("data-cts-scene-nav-mode") ?? "";
    }
    applyScenesNavFilter(root, mode);
    syncToolbarActive(toolbar, mode, (b) => b.getAttribute("data-cts-scene-nav-mode"));
  });

  const sidebar = root.querySelector(".directory-sidebar");
  const anchor = sidebar instanceof HTMLElement ? sidebar : root;
  anchor.insertAdjacentElement("afterbegin", toolbar);

  const stored = readStored(SCENES_STATE.storageKey);
  applyScenesNavFilter(root, stored);
  syncToolbarActive(toolbar, stored, (b) => b.getAttribute("data-cts-scene-nav-mode"));
  ensureRowObserver(root, SCENES_STATE.rowTagger);

  log(`mounted [scenes] toolbar`, { stored });
  return true;
}

function injectAll() {
  let mounted = 0;
  for (const def of TOOLBAR_DEFS) {
    if (injectTypedToolbar(def)) mounted += 1;
  }
  if (injectScenesToolbar()) mounted += 1;
  return mounted;
}

/* ------------------------------------------------------------------ */
/* Hook + polling registration                                         */
/* ------------------------------------------------------------------ */

let _registered = false;

export function registerDirectoryFilterToolbars() {
  if (_registered) return;
  _registered = true;

  /* 1) Direct render hooks */
  Hooks.on("renderItemDirectory", () => queueMicrotask(() => injectTypedToolbar(TOOLBAR_DEFS[0])));
  Hooks.on("renderActorDirectory", () => queueMicrotask(() => injectTypedToolbar(TOOLBAR_DEFS[1])));
  Hooks.on("renderMacroDirectory", () => queueMicrotask(() => injectTypedToolbar(TOOLBAR_DEFS[2])));
  Hooks.on("renderSceneDirectory", () => queueMicrotask(injectScenesToolbar));

  /* 2) Generic ApplicationV2 fallback for v14 */
  Hooks.on("renderApplicationV2", (app) => {
    const name = app?.constructor?.name;
    queueMicrotask(() => {
      if (name === "ItemDirectory") injectTypedToolbar(TOOLBAR_DEFS[0]);
      else if (name === "ActorDirectory") injectTypedToolbar(TOOLBAR_DEFS[1]);
      else if (name === "MacroDirectory") injectTypedToolbar(TOOLBAR_DEFS[2]);
      else if (name === "SceneDirectory") injectScenesToolbar();
    });
  });

  /* 3) Polling safety net: try every 750ms for the first 30s after page load */
  let attempts = 0;
  const maxAttempts = 40;
  const interval = setInterval(() => {
    attempts += 1;
    injectAll();
    if (attempts >= maxAttempts) clearInterval(interval);
  }, 750);

  /* 4) MutationObserver on #sidebar — catches lazy tab renders forever */
  Hooks.once("ready", () => {
    queueMicrotask(() => {
      const mounted = injectAll();
      log("ready: pass mounted", mounted, "of 4 directory toolbars");

      const sidebar = document.getElementById("sidebar") ?? document.querySelector("#sidebar");
      if (sidebar instanceof HTMLElement) {
        const obs = new MutationObserver(() => {
          /* Debounce via microtask so a single mutation batch results in one inject pass */
          queueMicrotask(injectAll);
        });
        obs.observe(sidebar, { childList: true, subtree: true });
        log("sidebar MutationObserver active");
      } else {
        log("WARN: #sidebar not found at ready");
      }
    });
  });

  log("registered render hooks + polling fallback");
}
