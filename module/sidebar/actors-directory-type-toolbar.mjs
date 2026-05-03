import { isDirectoryTypeToolbarsEnabled } from "./directory-type-toolbars-shared.mjs";
import { applyActorFactionDirectoryVisualFilter } from "../hooks/actor-faction-groups.mjs";
import { sidebarDirectoryRootFromRenderArgs } from "./sidebar-directory-root.mjs";
import { tagWorldActorDirectoryRows } from "./world-actor-directory-rows.mjs";

const STORAGE_KEY = "CTS-DND-35.actorDirectoryTypeFilter";

/** @type {WeakMap<HTMLElement, MutationObserver>} */
const observers = new WeakMap();
let _hooked = false;

function orderedActorTypes() {
  const raw = game.system?.documentTypes?.Actor;
  /** @type {string[]} */
  let list = [];
  if (Array.isArray(raw)) list = raw.map(String);
  else if (raw && typeof raw === "object") list = Object.keys(raw);
  else if (CONFIG.Actor?.typeLabels && typeof CONFIG.Actor.typeLabels === "object") {
    list = Object.keys(CONFIG.Actor.typeLabels);
  }
  list.sort((a, b) => String(a).localeCompare(String(b), undefined, { sensitivity: "base" }));
  return list;
}

function actorTypeLabel(type) {
  const tl = CONFIG.Actor?.typeLabels?.[type];
  if (tl && typeof tl === "string") {
    const loc = game.i18n.localize(tl);
    if (loc && loc !== tl) return loc;
  }
  const ctsKey = `CTSDND35.ActorType${type.charAt(0).toUpperCase()}${type.slice(1)}`;
  const loc2 = game.i18n.localize(ctsKey);
  if (loc2 && loc2 !== ctsKey) return loc2;
  return typeof foundry?.utils?.titleCase === "function" ? foundry.utils.titleCase(type) : type;
}

function isCoreWorldActorDirectory(app) {
  if (!app || app.constructor?.name !== "ActorDirectory") return false;
  try {
    if (game.actors && app.collection === game.actors) return true;
  } catch {
    /* ignore */
  }
  const tab = app.tabName ?? app.options?.id;
  return tab === "actors" || app.id === "actors" || app.options?.uniqueId === "actors";
}

function getStoredType() {
  try {
    return sessionStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function setStoredType(type) {
  try {
    if (!type) sessionStorage.removeItem(STORAGE_KEY);
    else sessionStorage.setItem(STORAGE_KEY, type);
  } catch {
    /* ignore */
  }
}

function escapeType(type) {
  if (!type || !/^[a-z0-9_-]+$/i.test(type)) return "";
  return type;
}

function syncToolbarButtons(toolbar, activeType) {
  const safe = escapeType(activeType);
  for (const btn of toolbar.querySelectorAll("button.cts-items-rail-btn")) {
    const isAll = btn.classList.contains("cts-items-rail-btn--all");
    const t = isAll ? "" : (btn.getAttribute("data-cts-actor-type") ?? "");
    btn.classList.toggle("active", isAll ? !safe : t === safe);
  }
}

function applyActorTypeToRoot(root, type) {
  if (!(root instanceof HTMLElement)) return;
  const safe = escapeType(type);
  if (!safe) {
    delete root.dataset.ctsDirectoryActorType;
    setStoredType("");
  } else {
    root.dataset.ctsDirectoryActorType = safe;
    setStoredType(safe);
  }
  tagWorldActorDirectoryRows(root);
  const sel = root.querySelector(".cts-actor-group-toolbar select.cts-actor-group-filter");
  applyActorFactionDirectoryVisualFilter(root, sel?.value ?? "");
}

function wireToolbar(toolbar, root) {
  toolbar.addEventListener("click", (ev) => {
    const btn = ev.target?.closest?.("button.cts-items-rail-btn");
    if (!(btn instanceof HTMLButtonElement)) return;
    ev.preventDefault();
    ev.stopPropagation();
    let type = "";
    if (btn.classList.contains("cts-items-rail-btn--all")) type = "";
    else type = btn.getAttribute("data-cts-actor-type") ?? "";
    applyActorTypeToRoot(root, type);
    syncToolbarButtons(toolbar, type);
  });
}

function ensureObserver(root) {
  if (observers.has(root)) return;
  const obs = new MutationObserver(() => {
    tagWorldActorDirectoryRows(root);
    const sel = root.querySelector(".cts-actor-group-toolbar select.cts-actor-group-filter");
    applyActorFactionDirectoryVisualFilter(root, sel?.value ?? "");
  });
  obs.observe(root, { childList: true, subtree: true });
  observers.set(root, obs);
}

function buildToolbar(types) {
  const nav = document.createElement("nav");
  nav.className = "cts-items-type-toolbar";
  nav.setAttribute("role", "tablist");
  nav.setAttribute("aria-label", game.i18n.localize("CTSDND35.DirectoryTypeToolbarsActorsAria"));

  const stored = getStoredType();
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
    b.dataset.ctsActorType = t;
    b.setAttribute("role", "tab");
    const label = actorTypeLabel(t);
    b.title = label;
    b.textContent = label;
    nav.appendChild(b);
  }
  return nav;
}

function injectToolbarAtRoot(root) {
  if (!(root instanceof HTMLElement)) return;
  const types = orderedActorTypes();
  if (types.length < 2) return;
  if (root.querySelector(".cts-items-type-toolbar[data-cts-toolbar-kind='actors']")) return;

  const toolbar = buildToolbar(types);
  toolbar.dataset.ctsToolbarKind = "actors";
  wireToolbar(toolbar, root);

  const sidebar = root.querySelector(".directory-sidebar");
  const anchor = sidebar instanceof HTMLElement ? sidebar : root;
  anchor.insertAdjacentElement("afterbegin", toolbar);

  const stored = getStoredType();
  applyActorTypeToRoot(root, stored);
  syncToolbarButtons(toolbar, stored);
  ensureObserver(root);
}

function scheduleActorDirectoryInject(app, html) {
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

export function cleanupActorsDirectoryTypeToolbar() {
  const el = ui?.actors?.element;
  el?.querySelector(".cts-items-type-toolbar[data-cts-toolbar-kind='actors']")?.remove();
  if (el instanceof HTMLElement) {
    delete el.dataset.ctsDirectoryActorType;
    tagWorldActorDirectoryRows(el);
    const sel = el.querySelector(".cts-actor-group-toolbar select.cts-actor-group-filter");
    applyActorFactionDirectoryVisualFilter(el, sel?.value ?? "");
  }
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function registerActorsDirectoryTypeToolbar() {
  if (_hooked) return;
  _hooked = true;

  Hooks.on("renderActorDirectory", (app, html) => {
    if (!isDirectoryTypeToolbarsEnabled()) return;
    if (!isCoreWorldActorDirectory(app)) return;
    scheduleActorDirectoryInject(app, html);
  });
}
