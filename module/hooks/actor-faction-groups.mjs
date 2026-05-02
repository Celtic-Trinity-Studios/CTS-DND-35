/**
 * Actor sidebar: filter by faction labels (legacy groups string + factionAffiliations names).
 * Create Actor dialog: optional comma tags → groups + initial faction rows.
 */

import { actorFactionFilterTokens, normalizeGroupsForSave, parseGroupTokens } from "../utils/faction-groups.mjs";

const STORAGE_KEY = "CTS-DND-35.actorGroupDirectoryFilter";
let _pendingCreateActorGroups = null;
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

function _capturePendingGroupsFromForm(form) {
  const v = form.querySelector('input[name="ctsInitialGroups"]')?.value ?? "";
  _pendingCreateActorGroups = normalizeGroupsForSave(parseGroupTokens(v)) || null;
}

function _tryInjectCreateActorGroups(htmlRoot, _dialogApp) {
  const form = htmlRoot.querySelector("form");
  if (!form) return;

  if (form.classList.contains("sheet") || form.querySelector(".sheet-tabs")) return;

  const nameInput = form.querySelector('input[name="name"]');
  const typeSelect =
    form.querySelector('select[name="type"]') ||
    form.querySelector("select[data-document-type]") ||
    form.querySelector('select[name="documentType"]');
  if (!nameInput || !typeSelect) return;
  if (!typeSelect.querySelector?.('option[value="character"]')) return;

  const existing = form.querySelector(".cts-create-actor-groups");
  if (existing) return;

  const wrap = document.createElement("div");
  wrap.className = "form-group cts-create-actor-groups";
  const datalistId = `cts-create-group-presets-${foundry.utils.randomID()}`;
  const presets = _presetLines();
  const presetOpts = presets.map((p) => `<option value="${foundry.utils.escapeHTML(p)}"></option>`).join("");
  wrap.innerHTML = `
    <label>${game.i18n.localize("CTSDND35.CreateActorGroupsLabel")}</label>
    <input type="text" name="ctsInitialGroups" list="${datalistId}" placeholder="${foundry.utils.escapeHTML(game.i18n.localize("CTSDND35.CreateActorGroupsPlaceholder"))}" />
    <datalist id="${datalistId}">${presetOpts}</datalist>
    <p class="hint">${game.i18n.localize("CTSDND35.CreateActorGroupsHint")}</p>`;

  const typeRow = typeSelect?.closest(".form-group");
  const folderSelect = form.querySelector('select[name="folder"]');
  const folderRow = folderSelect?.closest(".form-group");
  const anchor = folderRow ?? typeRow;
  if (anchor?.nextElementSibling) anchor.insertAdjacentElement("afterend", wrap);
  else form.appendChild(wrap);

  const onCommit = () => _capturePendingGroupsFromForm(form);
  form.addEventListener("submit", onCommit, { capture: true });
  form.querySelector('button[type="submit"]')?.addEventListener("click", onCommit);
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

  Hooks.on("renderDialog", (dialogApp, html) => {
    const root = _rootEl(html);
    if (!root) return;
    _tryInjectCreateActorGroups(root, dialogApp);
  });

  Hooks.on("renderApplicationV2", (application, element) => {
    if (!(element instanceof HTMLElement)) return;
    if (!element.querySelector?.("form")) return;
    _tryInjectCreateActorGroups(element, application);
  });

  Hooks.on("createActor", (document, _data, _opts, userId) => {
    queueMicrotask(() => _refreshAllDirectoryGroupFilters());
    if (userId !== game.userId) return;
    const g = _pendingCreateActorGroups;
    _pendingCreateActorGroups = null;
    if (!g) return;
    const tokens = parseGroupTokens(g);
    void document.update({
      "system.details.groups": g,
      "system.details.factionAffiliations": tokens.map((name) => ({ name, gearPct: 0, notes: "" })),
    });
  });
}
