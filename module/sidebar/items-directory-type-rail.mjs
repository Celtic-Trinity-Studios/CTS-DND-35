import { DIRECTORY_ROW_SELECTOR, tagWorldItemDirectoryRows } from "./world-item-directory-rows.mjs";

const ItemDirectory = foundry.applications.sidebar.tabs.ItemDirectory;

const STORAGE_KEY = "CTS-DND-35.itemsDirectoryTypeFilter";
const FILTER_STYLE_ID = "cts-items-directory-filter-css";

/** @type {WeakMap<HTMLElement, MutationObserver>} */
const observers = new WeakMap();

let _registered = false;

function orderedItemTypes() {
  const raw = game.system?.documentTypes?.Item;
  const list = Array.isArray(raw) ? [...raw] : [];
  list.sort((a, b) => String(a).localeCompare(String(b), undefined, { sensitivity: "base" }));
  return list;
}

function isCoreWorldItemDirectory(app) {
  return Boolean(app && app instanceof ItemDirectory && app.tabName === "items");
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

function clearInjectedFilterStyle() {
  const style = document.getElementById(FILTER_STYLE_ID);
  if (style) style.textContent = "";
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
  style.textContent = `
#items[data-cts-items-filter="${safe}"] ${DIRECTORY_ROW_SELECTOR}:not(.folder):not([data-cts-item-type="${safe}"]) {
  display: none !important;
}`;
}

function applyFilterToRoot(root, type) {
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

function syncRailActiveButtons(rail, type) {
  const safe = escapeCssIdent(type);
  for (const btn of rail.querySelectorAll("button.cts-items-rail-btn")) {
    const isAll = btn.classList.contains("cts-items-rail-btn--all");
    const t = isAll ? "" : (btn.getAttribute("data-cts-item-type") ?? "");
    btn.classList.toggle("active", isAll ? !safe : t === safe);
  }
}

function buildRail(types) {
  const nav = document.createElement("nav");
  nav.className = "cts-items-type-rail";
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
    const label = game.i18n.localize(CONFIG.Item.typeLabels?.[t] ?? t);
    b.title = label;
    b.textContent = label;
    nav.appendChild(b);
  }

  return nav;
}

function wireRail(rail, root) {
  rail.addEventListener("click", (ev) => {
    const btn = ev.target?.closest?.("button.cts-items-rail-btn");
    if (!(btn instanceof HTMLButtonElement)) return;
    let type = "";
    if (btn.classList.contains("cts-items-rail-btn--all")) type = "";
    else type = btn.getAttribute("data-cts-item-type") ?? "";
    applyFilterToRoot(root, type);
    syncRailActiveButtons(rail, type);
  });
}

function ensureObserver(root) {
  if (observers.has(root)) return;
  const obs = new MutationObserver(() => {
    tagWorldItemDirectoryRows(root);
  });
  obs.observe(root, { childList: true, subtree: true });
  observers.set(root, obs);
}

function injectRail(app) {
  const root = app.element;
  if (!(root instanceof HTMLElement)) return;
  if (root.querySelector(".cts-items-type-rail")) return;

  const types = orderedItemTypes();
  const rail = buildRail(types);
  wireRail(rail, root);

  const sidebar = root.querySelector(".directory-sidebar");
  const anchor = sidebar instanceof HTMLElement ? sidebar : root;
  anchor.insertAdjacentElement("afterbegin", rail);

  const stored = getStoredFilter();
  applyFilterToRoot(root, stored);
  syncRailActiveButtons(rail, stored);
  ensureObserver(root);
}

export function registerItemsDirectoryTypeRail() {
  if (_registered) return;
  _registered = true;

  game.settings.register("CTS-DND-35", "itemsDirectoryTypeRail", {
    name: game.i18n.localize("CTSDND35.ItemsDirectoryTypeRailName"),
    hint: game.i18n.localize("CTSDND35.ItemsDirectoryTypeRailHint"),
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
    onChange: (enabled) => {
      if (!enabled) {
        const el = ui?.items?.element;
        el?.querySelector(".cts-items-type-rail")?.remove();
        if (el instanceof HTMLElement) {
          delete el.dataset.ctsItemsFilter;
          tagWorldItemDirectoryRows(el);
        }
        clearInjectedFilterStyle();
      }
      ui?.items?.render?.(false);
    },
  });

  Hooks.on("renderItemDirectory", (app) => {
    if (!game.settings.get("CTS-DND-35", "itemsDirectoryTypeRail")) return;
    if (!isCoreWorldItemDirectory(app)) return;
    injectRail(app);
  });
}
