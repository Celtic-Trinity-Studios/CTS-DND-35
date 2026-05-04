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

function _injectSidebarHelpButton(html) {
  const el = html instanceof HTMLElement ? html : html?.get?.(0) ?? html?.[0];
  if (!el?.querySelector) return;
  if (el.querySelector(".cts-sidebar-help-btn")) return;

  const wrap = document.createElement("div");
  wrap.className = "cts-sidebar-help-banner";
  wrap.innerHTML = `<button type="button" class="cts-sidebar-help-btn"><i class="fas fa-book-open"></i> ${game.i18n.localize(
    "CTSDND35.Help.OpenShort",
  )}</button>`;
  wrap.querySelector("button")?.addEventListener("click", (ev) => {
    ev.preventDefault();
    game.ctsdnd35?.openHelp?.();
  });

  const docBlock = el.querySelector("#settings-documentation");
  const gameBlock = el.querySelector("#settings-game");
  if (docBlock) docBlock.insertAdjacentElement("afterbegin", wrap);
  else if (gameBlock) gameBlock.insertAdjacentElement("afterbegin", wrap);
  else el.insertAdjacentElement("afterbegin", wrap);
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
