/**
 * Actor sidebar: filter by faction labels (faction items + legacy data).
 * Keeps actor groups string in sync with embedded faction items.
 */

import { actorFactionFilterTokens, syncActorGroupsFromFactionItems } from "../utils/faction-groups.mjs";
import { getItemAndActorFromHookArgs, getUpdateItemHookContext } from "../utils/item-hook-args.mjs";

const STORAGE_KEY = "CTS-DND-35.actorGroupDirectoryFilter";
/** @type {WeakMap<HTMLSelectElement, HTMLElement>} */
const directoryRootByFilterSelect = new WeakMap();

function _rootEl(html) {
  if (!html) return null;
  if (html.jquery && html[0]) return html[0];
  if (html instanceof HTMLElement) return html;
  return null;
}

function _collectUsedGroups() {
  const set = new Set();
  for (const a of game.actors ?? []) {
    for (const t of actorFactionFilterTokens(a)) set.add(t);
  }
  return [...set].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

function _presetLines() {
  const raw = game.settings?.get?.("CTS-DND-35", "factionGroupPresets") ?? "";
  return raw
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function _allFilterOptions() {
  const used = _collectUsedGroups();
  const presets = _presetLines();
  const merged = new Set([...presets, ...used]);
  return [...merged].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

function _actorMatchesFilter(actor, filterToken) {
  if (!filterToken) return true;
  const tokens = actorFactionFilterTokens(actor);
  const want = filterToken.trim().toLowerCase();
  return tokens.some((g) => g.toLowerCase() === want);
}

function applyDirectoryGroupFilter(htmlRoot, filterToken) {
  const list = htmlRoot.querySelector(".directory-list");
  if (!list) return;
  for (const li of list.querySelectorAll("li.directory-item[data-document-id]")) {
    const id = li.dataset.documentId;
    const actor = game.actors?.get(id);
    if (!actor) continue;
    const show = _actorMatchesFilter(actor, filterToken);
    li.style.display = show ? "" : "none";
    const tokens = actorFactionFilterTokens(actor);
    li.dataset.ctsGroups = tokens.join("|");
    li.title = tokens.length ? `${game.i18n.localize("CTSDND35.Groups")}: ${tokens.join(", ")}` : "";
  }
}

function _repopulateFilterSelect(sel, htmlRoot) {
  const cur = sel.value;
  sel.replaceChildren();
  const optAll = document.createElement("option");
  optAll.value = "";
  optAll.textContent = game.i18n.localize("CTSDND35.GroupFilterAll");
  sel.appendChild(optAll);
  for (const name of _allFilterOptions()) {
    const o = document.createElement("option");
    o.value = name;
    o.textContent = name;
    sel.appendChild(o);
  }
  const saved = sessionStorage.getItem(STORAGE_KEY) ?? "";
  const opts = _allFilterOptions();
  const pick = opts.includes(cur) ? cur : opts.includes(saved) ? saved : "";
  if (pick && [...sel.options].some((o) => o.value === pick)) sel.value = pick;
  else sel.value = "";
  applyDirectoryGroupFilter(htmlRoot, sel.value);
}

function _refreshAllDirectoryGroupFilters() {
  document.querySelectorAll(".cts-actor-group-toolbar select.cts-actor-group-filter").forEach((sel) => {
    const htmlRoot = directoryRootByFilterSelect.get(sel) ?? sel.closest(".directory-sidebar") ?? sel.closest("#actors");
    if (htmlRoot) _repopulateFilterSelect(sel, htmlRoot);
  });
}

/** Call after bulk faction / actor updates so sidebar group filters stay accurate. */
export function refreshActorDirectoryFactionFilters() {
  _refreshAllDirectoryGroupFilters();
}

function _injectDirectoryToolbar(htmlRoot) {
  const header = htmlRoot.querySelector(".directory-header");
  if (!header || htmlRoot.querySelector(".cts-actor-group-toolbar")) return;

  const wrap = document.createElement("div");
  wrap.className = "cts-actor-group-toolbar flexrow";
  wrap.innerHTML = `
    <label class="cts-actor-group-filter-label flexrow">
      <span class="cts-actor-group-filter-title">${game.i18n.localize("CTSDND35.GroupFilter")}</span>
      <select class="cts-actor-group-filter" title="${game.i18n.localize("CTSDND35.GroupFilterHint")}">
        <option value="">${game.i18n.localize("CTSDND35.GroupFilterAll")}</option>
      </select>
    </label>`;
  header.insertAdjacentElement("afterend", wrap);

  const sel = wrap.querySelector("select.cts-actor-group-filter");
  directoryRootByFilterSelect.set(sel, htmlRoot);

  _repopulateFilterSelect(sel, htmlRoot);

  sel.addEventListener("change", () => {
    sessionStorage.setItem(STORAGE_KEY, sel.value);
    applyDirectoryGroupFilter(htmlRoot, sel.value);
  });
}

function _scheduleFactionGroupSync(actor) {
  if (!actor) return;
  queueMicrotask(async () => {
    await syncActorGroupsFromFactionItems(actor);
    _refreshAllDirectoryGroupFilters();
  });
}

export function registerActorFactionGroupHooks() {
  game.settings.register("CTS-DND-35", "factionGroupPresets", {
    name: game.i18n.localize("CTSDND35.FactionPresetsName"),
    hint: game.i18n.localize("CTSDND35.FactionPresetsHint"),
    scope: "world",
    config: true,
    type: String,
    default: ["Party", "Allies", "Neutral", "Hostiles"].join("\n"),
  });

  Hooks.on("renderActorDirectory", (_app, html) => {
    const root = _rootEl(html);
    if (!root) return;
    _injectDirectoryToolbar(root);
  });

  Hooks.on("updateActor", () => {
    queueMicrotask(() => _refreshAllDirectoryGroupFilters());
  });

  Hooks.on("deleteActor", () => {
    queueMicrotask(() => _refreshAllDirectoryGroupFilters());
  });

  Hooks.on("createItem", (first, second) => {
    const { item, actor } = getItemAndActorFromHookArgs(first, second);
    const owner = actor ?? item?.actor ?? (item?.parent?.documentName === "Actor" ? item.parent : null);
    if (item?.type === "faction" && owner) _scheduleFactionGroupSync(owner);
  });

  Hooks.on("updateItem", (first, second, third) => {
    const { item, actor, changed } = getUpdateItemHookContext(first, second, third);
    const owner = actor ?? item?.actor ?? (item?.parent?.documentName === "Actor" ? item.parent : null);
    if (item?.type !== "faction" || !owner) return;
    const c = changed ?? {};
    if ("name" in c || "system" in c) _scheduleFactionGroupSync(owner);
  });

  Hooks.on("deleteItem", (first, second) => {
    const { item, actor } = getItemAndActorFromHookArgs(first, second);
    const owner = actor ?? item?.actor ?? (item?.parent?.documentName === "Actor" ? item.parent : null);
    if (item?.type === "faction" && owner) _scheduleFactionGroupSync(owner);
  });
}
