import { isDirectoryTypeToolbarsEnabled } from "./directory-type-toolbars-shared.mjs";
import { sidebarDirectoryRootFromRenderArgs } from "./sidebar-directory-root.mjs";
import { DIRECTORY_ROW_SELECTOR, tagWorldItemDirectoryRows } from "./world-item-directory-rows.mjs";

const STORAGE_KEY = "CTS-DND-35.itemsDirectoryTypeFilter";
const FILTER_STYLE_ID = "cts-items-directory-filter-css";
const FILTER_HOST_CLASS = "cts-item-type-filter-host";

/** @type {WeakMap<HTMLElement, MutationObserver>} */
const observers = new WeakMap();
let _hooked = false;

function orderedItemTypes() {
  const raw = game.system?.documentTypes?.Item;
  /** @type {string[]} */
  let list = [];
  if (Array.isArray(raw)) list = raw.map(String);
  else if (raw && typeof raw === "object") list = Object.keys(raw);
  else if (CONFIG.Item?.typeLabels && typeof CONFIG.Item.typeLabels === "object") {
    list = Object.keys(CONFIG.Item.typeLabels);
  }
  list.sort((a, b) => String(a).localeCompare(String(b), undefined, { sensitivity: "base" }));
  return list;
}

function isCoreWorldItemDirectory(app) {
  if (!app || app.constructor?.name !== "ItemDirectory") return false;
  try {
    if (game.items && app.collection === game.items) return true;
  } catch {
    /* ignore */
  }
  const tab = app.tabName ?? app.options?.id;
  return tab === "items" || app.id === "items" || app.options?.uniqueId === "items";
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

export function clearItemsDirectoryFilterStyle() {
  const style = document.getElementById(FILTER_STYLE_ID);
  if (style) style.textContent = "";
}

function itemTypeLabel(type) {
  const tl = CONFIG.Item?.typeLabels?.[type];
  if (tl && typeof tl === "string") {
    const loc = game.i18n.localize(tl);
    if (loc && loc !== tl) return loc;
  }
  const ctsKey = `CTSDND35.ItemType${type.charAt(0).toUpperCase()}${type.slice(1)}`;
  const loc2 = game.i18n.localize(ctsKey);
  if (loc2 && loc2 !== ctsKey) return loc2;
  return typeof foundry?.utils?.titleCase === "function" ? foundry.utils.titleCase(type) : type;
}

function buildFilterCssRules(safe) {
  const host = `.${FILTER_HOST_CLASS}[data-cts-items-filter="${safe}"]`;
  return DIRECTORY_ROW_SELECTOR.split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(
      (sel) =>
        `${host} ${sel}:not(.folder):not([data-cts-item-type="${safe}"]) { display: none !important; }`
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

function applyFilterToRoot(root, type) {
  if (!(root instanceof HTMLElement)) return;
  root.classList.add(FILTER_HOST_CLASS);
  const safe = escapeCssIdent(type);
  if (!safe) {
    delete root.dataset.ctsItemsFilter;
    updateFilterStyle("");
    setStoredFilter("");
  } else {
    root.dataset.ctsItemsFilter = safe;
    updateFilterStyle(safe);
    setStoredFilter(safe);
  }
  tagWorldItemDirectoryRows(root);
}

function syncRailActiveButtons(toolbar, type) {
  const safe = escapeCssIdent(type);
  for (const btn of toolbar.querySelectorAll("button.cts-items-rail-btn")) {
    const isAll = btn.classList.contains("cts-items-rail-btn--all");
    const t = isAll ? "" : (btn.getAttribute("data-cts-item-type") ?? "");
    btn.classList.toggle("active", isAll ? !safe : t === safe);
  }
}

function buildToolbar(types) {
  const nav = document.createElement("nav");
  nav.className = "cts-items-type-toolbar";
  nav.dataset.ctsToolbarKind = "items";
  nav.setAttribute("role", "tablist");
  nav.setAttribute("aria-label", game.i18n.localize("CTSDND35.ItemsRailAria"));

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
    b.dataset.ctsItemType = t;
    b.setAttribute("role", "tab");
    const label = itemTypeLabel(t);
    b.title = label;
    b.textContent = label;
    nav.appendChild(b);
  }

  return nav;
}

function wireToolbar(toolbar, root) {
  toolbar.addEventListener("click", (ev) => {
    const btn = ev.target?.closest?.("button.cts-items-rail-btn");
    if (!(btn instanceof HTMLButtonElement)) return;
    ev.preventDefault();
    ev.stopPropagation();
    let type = "";
    if (btn.classList.contains("cts-items-rail-btn--all")) type = "";
    else type = btn.getAttribute("data-cts-item-type") ?? "";
    applyFilterToRoot(root, type);
    syncRailActiveButtons(toolbar, type);
  });
}

function ensureObserver(root) {
  if (observers.has(root)) return;
  const obs = new MutationObserver(() => tagWorldItemDirectoryRows(root));
  obs.observe(root, { childList: true, subtree: true });
  observers.set(root, obs);
}

function injectToolbarAtRoot(root) {
  if (!(root instanceof HTMLElement)) return;
  root.classList.add(FILTER_HOST_CLASS);
  if (root.querySelector(".cts-items-type-toolbar[data-cts-toolbar-kind='items']")) return;

  const types = orderedItemTypes();
  const toolbar = buildToolbar(types);
  wireToolbar(toolbar, root);

  const sidebar = root.querySelector(".directory-sidebar");
  const anchor = sidebar instanceof HTMLElement ? sidebar : root;
  anchor.insertAdjacentElement("afterbegin", toolbar);

  const stored = getStoredFilter();
  applyFilterToRoot(root, stored);
  syncRailActiveButtons(toolbar, stored);
  ensureObserver(root);
}

/** ApplicationV2 hooks can run before `app.element` exists; retry like the pre-refactor rail. */
function scheduleItemDirectoryInject(app, html) {
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

export function cleanupItemsDirectoryTypeToolbar() {
  const el = ui?.items?.element;
  el?.querySelector(".cts-items-type-toolbar[data-cts-toolbar-kind='items']")?.remove();
  if (el instanceof HTMLElement) {
    delete el.dataset.ctsItemsFilter;
    el.classList.remove(FILTER_HOST_CLASS);
    tagWorldItemDirectoryRows(el);
  }
  clearItemsDirectoryFilterStyle();
}

export function registerItemsDirectoryTypeToolbar() {
  if (_hooked) return;
  _hooked = true;

  Hooks.on("renderItemDirectory", (app, html) => {
    if (!isDirectoryTypeToolbarsEnabled()) return;
    if (!isCoreWorldItemDirectory(app)) return;
    scheduleItemDirectoryInject(app, html);
  });
}
