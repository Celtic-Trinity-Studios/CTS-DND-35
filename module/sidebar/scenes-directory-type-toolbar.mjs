import { isDirectoryTypeToolbarsEnabled } from "./directory-type-toolbars-shared.mjs";
import { sidebarDirectoryRootFromRenderArgs } from "./sidebar-directory-root.mjs";
import { DIRECTORY_ROW_SELECTOR, tagWorldSceneDirectoryRows } from "./world-scene-directory-rows.mjs";

const STORAGE_KEY = "CTS-DND-35.scenesDirectoryNavFilter";
const FILTER_STYLE_ID = "cts-scenes-directory-filter-css";
const FILTER_HOST_CLASS = "cts-scene-nav-filter-host";

/** @type {WeakMap<HTMLElement, MutationObserver>} */
const observers = new WeakMap();
let _hooked = false;

function isCoreWorldSceneDirectory(app) {
  if (!app || app.constructor?.name !== "SceneDirectory") return false;
  try {
    if (game.scenes && app.collection === game.scenes) return true;
  } catch {
    /* ignore */
  }
  const tab = app.tabName ?? app.options?.id;
  return tab === "scenes" || app.id === "scenes" || app.options?.uniqueId === "scenes";
}

function getStoredFilter() {
  try {
    return sessionStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function setStoredFilter(mode) {
  try {
    if (!mode) sessionStorage.removeItem(STORAGE_KEY);
    else sessionStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
}

function clearFilterStyle() {
  const style = document.getElementById(FILTER_STYLE_ID);
  if (style) style.textContent = "";
}

/**
 * @param {"nav"|"nonav"} mode
 */
function buildFilterCssRules(mode) {
  const host = `.${FILTER_HOST_CLASS}[data-cts-scenes-nav-filter="${mode}"]`;
  const branches = DIRECTORY_ROW_SELECTOR.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (mode === "nav") {
    return branches
      .map(
        (sel) =>
          `${host} ${sel}:not(.folder):not([data-cts-scene-nav="true"]) { display: none !important; }`
      )
      .join("\n");
  }
  return branches
    .map(
      (sel) =>
        `${host} ${sel}:not(.folder):not([data-cts-scene-nav="false"]) { display: none !important; }`
    )
    .join("\n");
}

function updateFilterStyle(mode) {
  let style = document.getElementById(FILTER_STYLE_ID);
  if (!style) {
    style = document.createElement("style");
    style.id = FILTER_STYLE_ID;
    document.head.appendChild(style);
  }
  if (!mode || (mode !== "nav" && mode !== "nonav")) {
    style.textContent = "";
    return;
  }
  style.textContent = buildFilterCssRules(/** @type {"nav"|"nonav"} */ (mode));
}

function applyFilterToRoot(root, mode) {
  if (!(root instanceof HTMLElement)) return;
  root.classList.add(FILTER_HOST_CLASS);
  if (!mode || mode === "") {
    delete root.dataset.ctsScenesNavFilter;
    updateFilterStyle("");
    setStoredFilter("");
  } else {
    root.dataset.ctsScenesNavFilter = mode;
    updateFilterStyle(mode);
    setStoredFilter(mode);
  }
  tagWorldSceneDirectoryRows(root);
}

function syncButtons(toolbar, mode) {
  const m = mode ?? "";
  for (const btn of toolbar.querySelectorAll("button.cts-items-rail-btn")) {
    const isAll = btn.classList.contains("cts-items-rail-btn--all");
    const v = isAll ? "" : (btn.getAttribute("data-cts-scene-nav-mode") ?? "");
    btn.classList.toggle("active", isAll ? !m : v === m);
  }
}

function wireToolbar(toolbar, root) {
  toolbar.addEventListener("click", (ev) => {
    const btn = ev.target?.closest?.("button.cts-items-rail-btn");
    if (!(btn instanceof HTMLButtonElement)) return;
    ev.preventDefault();
    ev.stopPropagation();
    let mode = "";
    if (btn.classList.contains("cts-items-rail-btn--all")) mode = "";
    else mode = btn.getAttribute("data-cts-scene-nav-mode") ?? "";
    applyFilterToRoot(root, mode);
    syncButtons(toolbar, mode);
  });
}

function ensureObserver(root) {
  if (observers.has(root)) return;
  const obs = new MutationObserver(() => tagWorldSceneDirectoryRows(root));
  obs.observe(root, { childList: true, subtree: true });
  observers.set(root, obs);
}

function injectToolbarAtRoot(root) {
  if (!(root instanceof HTMLElement)) return;
  root.classList.add(FILTER_HOST_CLASS);
  if (root.querySelector(".cts-items-type-toolbar[data-cts-toolbar-kind='scenes']")) return;

  const nav = document.createElement("nav");
  nav.className = "cts-items-type-toolbar";
  nav.dataset.ctsToolbarKind = "scenes";
  nav.setAttribute("role", "tablist");
  nav.setAttribute("aria-label", game.i18n.localize("CTSDND35.DirectoryTypeToolbarsScenesAria"));

  const stored = getStoredFilter();
  const allBtn = document.createElement("button");
  allBtn.type = "button";
  allBtn.className = `cts-items-rail-btn cts-items-rail-btn--all${!stored ? " active" : ""}`;
  allBtn.setAttribute("role", "tab");
  allBtn.title = game.i18n.localize("CTSDND35.ItemsRailAll");
  allBtn.textContent = game.i18n.localize("CTSDND35.ItemsRailAll");
  nav.appendChild(allBtn);

  const navBtn = document.createElement("button");
  navBtn.type = "button";
  navBtn.className = `cts-items-rail-btn${stored === "nav" ? " active" : ""}`;
  navBtn.dataset.ctsSceneNavMode = "nav";
  navBtn.setAttribute("role", "tab");
  navBtn.title = game.i18n.localize("CTSDND35.SceneFilterNavHint");
  navBtn.textContent = game.i18n.localize("CTSDND35.SceneFilterNav");
  nav.appendChild(navBtn);

  const nonBtn = document.createElement("button");
  nonBtn.type = "button";
  nonBtn.className = `cts-items-rail-btn${stored === "nonav" ? " active" : ""}`;
  nonBtn.dataset.ctsSceneNavMode = "nonav";
  nonBtn.setAttribute("role", "tab");
  nonBtn.title = game.i18n.localize("CTSDND35.SceneFilterNonNavHint");
  nonBtn.textContent = game.i18n.localize("CTSDND35.SceneFilterNonNav");
  nav.appendChild(nonBtn);

  wireToolbar(nav, root);
  const sidebar = root.querySelector(".directory-sidebar");
  const anchor = sidebar instanceof HTMLElement ? sidebar : root;
  anchor.insertAdjacentElement("afterbegin", nav);

  applyFilterToRoot(root, stored);
  syncButtons(nav, stored);
  ensureObserver(root);
}

function scheduleSceneDirectoryInject(app, html) {
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

export function cleanupScenesDirectoryTypeToolbar() {
  const el = ui?.scenes?.element;
  el?.querySelector(".cts-items-type-toolbar[data-cts-toolbar-kind='scenes']")?.remove();
  if (el instanceof HTMLElement) {
    delete el.dataset.ctsScenesNavFilter;
    el.classList.remove(FILTER_HOST_CLASS);
    tagWorldSceneDirectoryRows(el);
  }
  clearFilterStyle();
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function registerScenesDirectoryTypeToolbar() {
  if (_hooked) return;
  _hooked = true;

  Hooks.on("renderSceneDirectory", (app, html) => {
    if (!isDirectoryTypeToolbarsEnabled()) return;
    if (!isCoreWorldSceneDirectory(app)) return;
    scheduleSceneDirectoryInject(app, html);
  });
}
