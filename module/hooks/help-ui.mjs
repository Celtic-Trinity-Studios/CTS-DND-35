/**
 * Inject “System help” entry points into Foundry UI (Configure Settings dialog + sidebar).
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
 * Help & Documentation block in the sidebar Settings tab (Support / Documentation / Wiki).
 * Prefer #settings-documentation (v10+); fall back to the section whose heading matches.
 */
function _findHelpDocumentationSection(root) {
  const byId = root.querySelector("#settings-documentation");
  if (byId) return byId;
  for (const h2 of root.querySelectorAll("h2")) {
    const t = (h2.textContent || "").trim().toLowerCase();
    if (t.includes("help") && t.includes("documentation")) return h2.parentElement;
  }
  return null;
}

function _injectSidebarHelpButton(html) {
  const el = html instanceof HTMLElement ? html : html?.get?.(0) ?? html?.[0];
  if (!el?.querySelector) return;
  if (el.querySelector("#cts-dnd-35-help-sidebar")) return;

  const docSection = _findHelpDocumentationSection(el);
  if (!docSection) return;

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

export function registerInGameHelpHooks() {
  Hooks.on("renderGameSettings", (_app, html) => {
    _injectConfigureSettingsButton(html);
  });
  Hooks.on("renderSettingsConfig", (_app, html) => {
    _injectConfigureSettingsButton(html);
  });
  Hooks.on("renderSidebarTab", (_app, html, data) => {
    const tabName =
      typeof data === "string"
        ? data
        : data?.tabName ?? data?.tab ?? "";
    if (tabName !== "settings") return;
    _injectSidebarHelpButton(html);
  });
}
