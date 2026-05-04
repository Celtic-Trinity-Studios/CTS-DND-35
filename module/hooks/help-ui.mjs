/**
 * Inject “System help” into Foundry UI.
 * v11–v13: renderSidebarTab. v14+: renderApplicationV2 + changeSidebarTab (ApplicationV2 sidebar).
 */

function _injectConfigureSettingsButton(html) {
  const $html = html instanceof HTMLElement ? $(html) : html;
  if (!$html?.length || $html.find(".cts-open-system-help").length) return;

  const label = game.i18n.localize("CTSDND35.Help.Open");
  const $btn = $(
    `<button type="button" class="cts-open-system-help"><i class="fas fa-book-open"></i> ${label}</button>`,
  );
  $btn.on("click", (ev) => {
    ev.preventDefault();
    game.ctsdnd35?.openHelp?.();
  });

  const $footer = $html.find("footer.form-footer, footer.dialog-footer, .window-footer").first();
  if ($footer.length) {
    $footer.prepend($btn);
    return;
  }
  const $form = $html.find("form").first();
  if ($form.length) {
    $form.append($(`<div class="form-group cts-help-settings-group"></div>`).append($btn));
  } else {
    $html.append($(`<div class="form-group cts-help-settings-group"></div>`).append($btn));
  }
}

/**
 * Help & Documentation block (Support / Documentation / Wiki).
 */
function _findHelpDocumentationSection(root) {
  if (!root?.querySelector) return null;
  const byId = root.querySelector("#settings-documentation");
  if (byId) return byId;
  for (const h2 of root.querySelectorAll("h2")) {
    const t = (h2.textContent || "").trim().toLowerCase();
    if (t.includes("help") && t.includes("documentation")) return h2.parentElement;
  }
  return null;
}

/** v14 may pass a fragment; fall back to live DOM under #sidebar. */
function _resolveDocSection(localRoot) {
  return (
    _findHelpDocumentationSection(localRoot) ??
    _findHelpDocumentationSection(document.getElementById("sidebar")) ??
    document.querySelector("#settings-documentation")
  );
}

function _isSettingsSidebarTab(app) {
  if (!app) return false;
  const optId = app.options?.id ?? app.options?.uniqueId;
  if (optId === "settings") return true;
  if (app.id === "settings") return true;
  if (app.tab === "settings" || app.tabName === "settings") return true;
  const nm = app.constructor?.name ?? "";
  if (nm === "Settings") return true;
  return false;
}

function _injectSidebarHelpInto(docSection) {
  if (!docSection?.appendChild) return;
  if (docSection.querySelector("#cts-dnd-35-help-sidebar")) return;

  const buttons = docSection.querySelectorAll("button");
  const refBtn = buttons.length ? buttons[buttons.length - 1] : null;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.id = "cts-dnd-35-help-sidebar";
  btn.setAttribute("data-cts-action", "system-help");

  const label = game.i18n.localize("CTSDND35.Help.SidebarLabel");
  btn.className = refBtn?.className || "button";
  const icon = document.createElement("i");
  icon.className = "fas fa-book-open";
  const span = document.createElement("span");
  span.textContent = label;
  btn.append(icon, span);

  btn.addEventListener("click", (ev) => {
    ev.preventDefault();
    game.ctsdnd35?.openHelp?.();
  });

  docSection.appendChild(btn);
}

function _injectSidebarHelpButton(html) {
  const el = html instanceof HTMLElement ? html : html?.get?.(0) ?? html?.[0];
  const local = el?.querySelector ? el : null;
  const docSection = _resolveDocSection(local);
  if (!docSection) return;
  _injectSidebarHelpInto(docSection);
}

let _sidebarObserver = null;

function _tryInjectFromSidebarDom() {
  const docSection = _resolveDocSection(document.getElementById("sidebar"));
  if (docSection) _injectSidebarHelpInto(docSection);
}

export function registerInGameHelpHooks() {
  Hooks.on("renderGameSettings", (_app, html) => {
    _injectConfigureSettingsButton(html);
  });
  Hooks.on("renderSettingsConfig", (_app, html) => {
    _injectConfigureSettingsButton(html);
  });

  /* Legacy (v11–v13) */
  Hooks.on("renderSidebarTab", (_app, html, data) => {
    const tabName =
      typeof data === "string"
        ? data
        : data?.tabName ?? data?.tab ?? data?.id ?? "";
    if (tabName !== "settings") return;
    _injectSidebarHelpButton(html);
  });

  /* Foundry v14+ ApplicationV2 — renderSidebarTab no longer exists; use this + DOM id. */
  Hooks.on("renderApplicationV2", (app, element) => {
    const direct = element?.querySelector?.("#settings-documentation");
    if (direct) {
      _injectSidebarHelpInto(direct);
      return;
    }
    if (_isSettingsSidebarTab(app)) _injectSidebarHelpButton(element);
  });

  Hooks.on("changeSidebarTab", (app) => {
    if (!_isSettingsSidebarTab(app)) return;
    queueMicrotask(() => _tryInjectFromSidebarDom());
  });

  Hooks.once("ready", () => {
    const sidebar = document.getElementById("sidebar");
    if (!sidebar || _sidebarObserver) return;
    _sidebarObserver = new MutationObserver(() => {
      _tryInjectFromSidebarDom();
    });
    _sidebarObserver.observe(sidebar, { childList: true, subtree: true });
    _tryInjectFromSidebarDom();
  });
}
