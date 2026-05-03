import { isDirectoryTypeToolbarsEnabled } from "./directory-type-toolbars-shared.mjs";
import { sidebarDirectoryRootFromRenderArgs } from "./sidebar-directory-root.mjs";
import { DIRECTORY_ROW_SELECTOR, tagWorldMacroDirectoryRows } from "./world-macro-directory-rows.mjs";

const STORAGE_KEY = "CTS-DND-35.macrosDirectoryTypeFilter";
const FILTER_STYLE_ID = "cts-macros-directory-filter-css";
const FILTER_HOST_CLASS = "cts-macro-type-filter-host";

/** @type {WeakMap<HTMLElement, MutationObserver>} */
const observers = new WeakMap();
let _hooked = false;

function orderedMacroTypes() {
  const T = CONST?.MACRO_TYPES;
  if (T && typeof T === "object" && !Array.isArray(T)) {
    return Object.keys(T).sort((a, b) => String(a).localeCompare(String(b), undefined, { sensitivity: "base" }));
  }
  return ["chat", "script"];
}

function isCoreWorldMacroDirectory(app) {
  if (!app || app.constructor?.name !== "MacroDirectory") return false;
  try {
    if (game.macros && app.collection === game.macros) return true;
  } catch {
    /* ignore */
  }
  const tab = app.tabName ?? app.options?.id;
  return tab === "macros" || app.id === "macros" || app.options?.uniqueId === "macros";
}

function getStoredFilter() {
  try {
    return sessionStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function setStoredFilter(type) {
  try {
    if (!type) sessionStorage.removeItem(STORAGE_KEY);
    else sessionStorage.setItem(STORAGE_KEY, type);
  } catch {
    /* ignore */
  }
}

function escapeCssIdent(type) {
  if (!type || !/^[a-z0-9_-]+$/i.test(type)) return "";
  return type;
}

function clearFilterStyle() {
  const style = document.getElementById(FILTER_STYLE_ID);
  if (style) style.textContent = "";
}

function buildFilterCssRules(safe) {
  const host = `.${FILTER_HOST_CLASS}[data-cts-macros-filter="${safe}"]`;
  return DIRECTORY_ROW_SELECTOR.split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(
      (sel) =>
        `${host} ${sel}:not(.folder):not([data-cts-macro-type="${safe}"]) { display: none !important; }`
    )
    .join("\n");
}

function updateFilterStyle(type) {
  let style = document.getElementById(FILTER_STYLE_ID);
  if (!style) {
    style = document.createElement("style");
    style.id = FILTER_STYLE_ID;
    document.head.appendChild(style);
  }
  const safe = escapeCssIdent(type);
  if (!safe) {
    style.textContent = "";
    return;
  }
  style.textContent = buildFilterCssRules(safe);
}

function macroTypeLabel(type) {
  const ctsKey = `CTSDND35.MacroType${type.charAt(0).toUpperCase()}${type.slice(1)}`;
  const loc = game.i18n.localize(ctsKey);
  if (loc && loc !== ctsKey) return loc;
  return typeof foundry?.utils?.titleCase === "function" ? foundry.utils.titleCase(type) : type;
}

function applyFilterToRoot(root, type) {
  if (!(root instanceof HTMLElement)) return;
  root.classList.add(FILTER_HOST_CLASS);
  const safe = escapeCssIdent(type);
  if (!safe) {
    delete root.dataset.ctsMacrosFilter;
    updateFilterStyle("");
    setStoredFilter("");
  } else {
    root.dataset.ctsMacrosFilter = safe;
    updateFilterStyle(safe);
    setStoredFilter(safe);
  }
  tagWorldMacroDirectoryRows(root);
}

function syncButtons(toolbar, type) {
  const safe = escapeCssIdent(type);
  for (const btn of toolbar.querySelectorAll("button.cts-items-rail-btn")) {
    const isAll = btn.classList.contains("cts-items-rail-btn--all");
    const t = isAll ? "" : (btn.getAttribute("data-cts-macro-type") ?? "");
    btn.classList.toggle("active", isAll ? !safe : t === safe);
  }
}

function wireToolbar(toolbar, root) {
  toolbar.addEventListener("click", (ev) => {
    const btn = ev.target?.closest?.("button.cts-items-rail-btn");
    if (!(btn instanceof HTMLButtonElement)) return;
    ev.preventDefault();
    ev.stopPropagation();
    let type = "";
    if (btn.classList.contains("cts-items-rail-btn--all")) type = "";
    else type = btn.getAttribute("data-cts-macro-type") ?? "";
    applyFilterToRoot(root, type);
    syncButtons(toolbar, type);
  });
}

function ensureObserver(root) {
  if (observers.has(root)) return;
  const obs = new MutationObserver(() => tagWorldMacroDirectoryRows(root));
  obs.observe(root, { childList: true, subtree: true });
  observers.set(root, obs);
}

function injectToolbarAtRoot(root) {
  if (!(root instanceof HTMLElement)) return;
  const types = orderedMacroTypes();
  if (types.length < 2) return;
  root.classList.add(FILTER_HOST_CLASS);
  if (root.querySelector(".cts-items-type-toolbar[data-cts-toolbar-kind='macros']")) return;

  const nav = document.createElement("nav");
  nav.className = "cts-items-type-toolbar";
  nav.dataset.ctsToolbarKind = "macros";
  nav.setAttribute("role", "tablist");
  nav.setAttribute("aria-label", game.i18n.localize("CTSDND35.DirectoryTypeToolbarsMacrosAria"));

  const stored = getStoredFilter();
  const allBtn = document.createElement("button");
  allBtn.type = "button";
  allBtn.className = `cts-items-rail-btn cts-items-rail-btn--all${!stored ? " active" : ""}`;
  allBtn.setAttribute("role", "tab");
  allBtn.title = game.i18n.localize("CTSDND35.ItemsRailAll");
  allBtn.textContent = game.i18n.localize("CTSDND35.ItemsRailAll");
  nav.appendChild(allBtn);

  for (const t of types) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `cts-items-rail-btn${stored === t ? " active" : ""}`;
    b.dataset.ctsMacroType = t;
    b.setAttribute("role", "tab");
    const label = macroTypeLabel(t);
    b.title = label;
    b.textContent = label;
    nav.appendChild(b);
  }

  wireToolbar(nav, root);
  const sidebar = root.querySelector(".directory-sidebar");
  const anchor = sidebar instanceof HTMLElement ? sidebar : root;
  anchor.insertAdjacentElement("afterbegin", nav);

  applyFilterToRoot(root, stored);
  syncButtons(nav, stored);
  ensureObserver(root);
}

function scheduleMacroDirectoryInject(app, html) {
  let frames = 0;
  const tick = () => {
    const root = sidebarDirectoryRootFromRenderArgs(app, html);
    if (root instanceof HTMLElement) {
      injectToolbarAtRoot(root);
      return;
    }
    frames += 1;
    if (frames < 24) requestAnimationFrame(tick);
  };
  queueMicrotask(tick);
}

export function cleanupMacrosDirectoryTypeToolbar() {
  const el = ui?.macros?.element;
  el?.querySelector(".cts-items-type-toolbar[data-cts-toolbar-kind='macros']")?.remove();
  if (el instanceof HTMLElement) {
    delete el.dataset.ctsMacrosFilter;
    el.classList.remove(FILTER_HOST_CLASS);
    tagWorldMacroDirectoryRows(el);
  }
  clearFilterStyle();
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function registerMacrosDirectoryTypeToolbar() {
  if (_hooked) return;
  _hooked = true;

  Hooks.on("renderMacroDirectory", (app, html) => {
    if (!isDirectoryTypeToolbarsEnabled()) return;
    if (!isCoreWorldMacroDirectory(app)) return;
    scheduleMacroDirectoryInject(app, html);
  });
}
