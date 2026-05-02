/**
 * Actor sidebar & creation UX for system.details.groups (comma / semicolon / newline separated).
 * - Directory toolbar filter by group token
 * - Context menu: set groups (GM / owners)
 * - Optional world preset list for datalist suggestions
 * - Create Actor dialog: optional initial groups field when dialog is detected
 */

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

function _parseGroupTokens(raw) {
  if (!raw || typeof raw !== "string") return [];
  return raw
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function _normalizeGroupsForSave(tokens) {
  const seen = new Set();
  const out = [];
  for (const t of tokens) {
    const k = t.trim().toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(t.trim());
  }
  return out.join(", ");
}

function _collectUsedGroups() {
  const set = new Set();
  for (const a of game.actors ?? []) {
    for (const t of _parseGroupTokens(a.system?.details?.groups)) set.add(t);
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
  const groups = _parseGroupTokens(actor.system?.details?.groups);
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
    const tokens = _parseGroupTokens(actor.system?.details?.groups);
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
  const pick = _allFilterOptions().includes(cur) ? cur : _allFilterOptions().includes(saved) ? saved : "";
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
              finish(_normalizeGroupsForSave(_parseGroupTokens(v)));
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
  _pendingCreateActorGroups = _normalizeGroupsForSave(_parseGroupTokens(v)) || null;
}

function _tryInjectCreateActorGroups(htmlRoot, dialogApp) {
  const form = htmlRoot.querySelector("form");
  if (!form) return;

  const title = (dialogApp?.options?.title ?? dialogApp?.title ?? "").toString().toLowerCase();
  const localizedActor = game.i18n.localize("DOCUMENT.Actor").toString().toLowerCase();
  const hasCharacterType = !!form.querySelector('select[name="type"] option[value="character"]');
  const looksActor =
    title.includes("create actor") || (localizedActor && title.includes(localizedActor)) || hasCharacterType;

  if (!looksActor) return;

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

  const typeSelect = form.querySelector('select[name="type"]');
  const typeRow = typeSelect?.closest(".form-group");
  const folderSelect = form.querySelector('select[name="folder"]');
  const folderRow = folderSelect?.closest(".form-group");
  const anchor = folderRow ?? typeRow;
  if (anchor?.nextElementSibling) anchor.insertAdjacentElement("afterend", wrap);
  else form.appendChild(wrap);

  const onCommit = () => _capturePendingGroupsFromForm(form);
  form.addEventListener("submit", onCommit, { capture: true });
  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn?.addEventListener("click", onCommit);
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

  Hooks.on("getActorDirectoryEntryContext", (html, entryOptions) => {
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
  });

  Hooks.on("renderDialog", (dialogApp, html) => {
    const root = _rootEl(html);
    if (!root) return;
    _tryInjectCreateActorGroups(root, dialogApp);
  });

  Hooks.on("createActor", (document, _data, _opts, userId) => {
    queueMicrotask(() => _refreshAllDirectoryGroupFilters());
    if (userId !== game.userId) return;
    const g = _pendingCreateActorGroups;
    _pendingCreateActorGroups = null;
    if (g) void document.update({ "system.details.groups": g });
  });
}
