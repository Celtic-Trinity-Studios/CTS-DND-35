/**
 * Actor sidebar & creation UX for system.details.groups (comma / semicolon / newline separated).
 * - Directory toolbar filter by group token
 * - Context menu: set groups (GM / owners) — Foundry 13+ uses getActorContextOptions
 * - Optional world preset list for datalist suggestions
 * - Create Actor dialog: optional initial groups (renderDialog + renderApplicationV2)
 */

import { normalizeGroupsForSave, parseGroupTokens } from "../utils/faction-groups.mjs";

const STORAGE_KEY = "CTS-DND-35.actorGroupDirectoryFilter";
let _pendingCreateActorGroups = null;
/** @type {WeakMap<HTMLSelectElement, HTMLElement>} */
const directoryRootByFilterSelect = new WeakMap();

function _foundryMajorVersion() {
  const v = String(game.version ?? "");
  const m = Number.parseInt(v.split(".")[0], 10);
  return Number.isFinite(m) ? m : 0;
}

function _rootEl(html) {
  if (!html) return null;
  if (html.jquery && html[0]) return html[0];
  if (html instanceof HTMLElement) return html;
  return null;
}

function _collectUsedGroups() {
  const set = new Set();
  for (const a of game.actors ?? []) {
    for (const t of parseGroupTokens(a.system?.details?.groups)) set.add(t);
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
  const groups = parseGroupTokens(actor.system?.details?.groups);
  const want = filterToken.trim().toLowerCase();
  return groups.some((g) => g.toLowerCase() === want);
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
    const tokens = parseGroupTokens(actor.system?.details?.groups);
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

function _dialogContentRoot(dlgHtml) {
  if (!dlgHtml) return null;
  if (dlgHtml.jquery && dlgHtml[0]) return dlgHtml[0];
  if (dlgHtml instanceof HTMLElement) return dlgHtml;
  return null;
}

async function _promptSetGroups(actor) {
  const current = actor.system?.details?.groups ?? "";
  const presets = _presetLines();
  const datalistId = `cts-group-presets-${foundry.utils.randomID()}`;
  const presetOpts = presets.map((p) => `<option value="${foundry.utils.escapeHTML(p)}"></option>`).join("");

  const html = `
    <form class="cts-set-groups-form">
      <p class="notes">${game.i18n.localize("CTSDND35.SetGroupsHint")}</p>
      <div class="form-group">
        <label>${game.i18n.localize("CTSDND35.Groups")}</label>
        <input type="text" name="groups" list="${datalistId}" value="${foundry.utils.escapeHTML(current)}" autofocus />
        <datalist id="${datalistId}">${presetOpts}</datalist>
      </div>
    </form>`;

  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    new Dialog(
      {
        title: game.i18n.localize("CTSDND35.SetGroupsTitle"),
        content: html,
        buttons: {
          save: {
            icon: '<i class="fas fa-save"></i>',
            label: game.i18n.localize("CTSDND35.DialogSave"),
            callback: (dlgHtml) => {
              const root = _dialogContentRoot(dlgHtml);
              const v = root?.querySelector('input[name="groups"]')?.value ?? "";
              finish(normalizeGroupsForSave(parseGroupTokens(v)));
            },
          },
          cancel: {
            icon: '<i class="fas fa-times"></i>',
            label: game.i18n.localize("CTSDND35.DialogCancel"),
            callback: () => finish(null),
          },
        },
        default: "save",
        close: () => finish(null),
      },
      { width: 420 }
    ).render(true);
  });
}

function _canConfigureActor(actor) {
  return game.user.isGM || actor.testUserPermission(game.user, "OWNER");
}

function _capturePendingGroupsFromForm(form) {
  const v = form.querySelector('input[name="ctsInitialGroups"]')?.value ?? "";
  _pendingCreateActorGroups = normalizeGroupsForSave(parseGroupTokens(v)) || null;
}

function _tryInjectCreateActorGroups(htmlRoot, _dialogApp) {
  const form = htmlRoot.querySelector("form");
  if (!form) return;

  // Never attach to full document sheets (would match actor/item windows on every render).
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

function _isActorDirectoryApplication(application) {
  if (!application) return false;
  if (application.constructor?.name === "ActorDirectory") return true;
  const id = application.id ?? application.options?.id ?? "";
  return id === "actors";
}

function _registerActorDirectoryContextMenus() {
  const pushLegacyMenu = (html, entryOptions) => {
    const actorId = html[0]?.dataset?.documentId;
    const actor = game.actors?.get(actorId);
    if (!actor || !_canConfigureActor(actor)) return;
    entryOptions.push({
      name: game.i18n.localize("CTSDND35.ContextSetGroups"),
      icon: '<i class="fas fa-users"></i>',
      callback: async () => {
        const next = await _promptSetGroups(actor);
        if (next === null) return;
        await actor.update({ "system.details.groups": next });
      },
      group: "ownership",
    });
  };

  const major = _foundryMajorVersion();
  if (major >= 13) {
    Hooks.on("getActorContextOptions", (application, menuItems) => {
      if (!_isActorDirectoryApplication(application)) return;
      menuItems.push({
        label: game.i18n.localize("CTSDND35.ContextSetGroups"),
        icon: '<i class="fas fa-users"></i>',
        group: "ownership",
        onClick: async (_event, target) => {
          const li = target?.closest?.("[data-document-id]");
          const id = li?.dataset?.documentId;
          const actor = game.actors?.get(id);
          if (!actor || !_canConfigureActor(actor)) return;
          const next = await _promptSetGroups(actor);
          if (next === null) return;
          await actor.update({ "system.details.groups": next });
        },
      });
    });
  } else {
    Hooks.on("getActorDirectoryEntryContext", (html, entryOptions) => {
      pushLegacyMenu(html, entryOptions);
    });
  }
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

  _registerActorDirectoryContextMenus();

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
    if (g) void document.update({ "system.details.groups": g });
  });
}
