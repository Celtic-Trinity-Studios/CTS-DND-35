/**
 * Inject “System help” into Foundry UI.
 * v11–v13: renderSidebarTab. v14+: ApplicationV2 + DOM heuristics (wiki / documentation ids).
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
 * Inject a help launcher directly in Game Settings under the CTS DND 3.5 category.
 * This targets the exact panel the user opened (Core / CTS DND 3.5 list).
 */
function _injectGameSettingsCategoryHelp(html) {
  const root = html instanceof HTMLElement ? html : html?.get?.(0) ?? html?.[0];
  if (!root?.querySelectorAll) return;
  if (root.querySelector("#cts-open-help-gamesettings")) return;

  const nodes = [
    ...root.querySelectorAll(".category, .settings-list > li, .settings-list > section, li, section, div"),
  ];
  const target = nodes.find((n) => {
    const t = (n.textContent || "").trim().toLowerCase();
    return t.includes("cts dnd 3.5");
  });
  if (!target) return;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.id = "cts-open-help-gamesettings";
  btn.className = "button cts-open-help-gamesettings";
  btn.innerHTML = `<i class="fas fa-book-open"></i><span>${game.i18n.localize("CTSDND35.Help.OpenShort")}</span>`;
  btn.addEventListener("click", (ev) => {
    ev.preventDefault();
    game.ctsdnd35?.openHelp?.();
  });

  target.appendChild(btn);
}

/** Prefer #sidebar; v14 layouts sometimes nest under #interface / #ui-right. */
function _sidebarRoots() {
  const roots = [
    document.getElementById("sidebar"),
    document.querySelector("aside#sidebar"),
    document.querySelector("#interface aside.sidebar"),
    document.querySelector("#ui-right"),
    document.querySelector("nav#sidebar-tabs")?.closest?.("aside"),
    document.getElementById("interface"),
  ];
  return [...new Set(roots.filter(Boolean))];
}

function _findDocContainerStrict(sidebar) {
  if (!sidebar?.querySelector) return null;
  return (
    sidebar.querySelector("#settings-documentation") ??
    sidebar.querySelector("[data-application-part='documentation']") ??
    null
  );
}

/** Legacy partial HTML (v11–v13): heading-based block inside a passed root. */
function _findHelpDocumentationSectionInRoot(root) {
  if (!root?.querySelector) return null;
  const strict = _findDocContainerStrict(root);
  if (strict) return strict;
  for (const h2 of root.querySelectorAll("h2")) {
    const t = (h2.textContent || "").trim().toLowerCase();
    if (t.includes("help") && t.includes("documentation")) return h2.parentElement;
  }
  return null;
}

/** v11: help links are often sequential siblings after the section h2 (no #settings-documentation). */
function _findWikiSiblingAfterHelpHeading(root) {
  if (!root?.querySelectorAll) return null;
  for (const h2 of root.querySelectorAll("h2")) {
    const t = (h2.textContent || "").trim().toLowerCase();
    if (!t.includes("help") || !t.includes("documentation")) continue;
    const collected = [];
    let n = h2.nextElementSibling;
    while (n && !n.matches?.("h2")) {
      if (n.matches?.("button")) collected.push(n);
      for (const b of n.querySelectorAll?.(":scope > button") ?? []) collected.push(b);
      n = n.nextElementSibling;
    }
    const wiki = collected.find((b) => {
      const bt = (b.textContent || "").trim().toLowerCase();
      return bt.includes("wiki");
    });
    if (wiki) return wiki;
  }
  return null;
}

/** Last core “Help & Documentation” control — insert after (v14 when no #settings-documentation). */
function _findLastCoreHelpDocControl(sidebar) {
  if (!sidebar?.querySelectorAll) return null;

  const wikiByAction = sidebar.querySelector(
    'button[data-action="wiki"], button[data-action="communityWiki"], a[data-action="wiki"]',
  );
  if (wikiByAction) return wikiByAction;

  const buttons = [...sidebar.querySelectorAll("button")];
  const wikiByText = buttons.find((b) => {
    const t = (b.textContent || "").trim().toLowerCase();
    return t.includes("wiki") && (t.includes("community") || t.includes("commun"));
  });
  if (wikiByText) return wikiByText;

  const docByText = buttons.find((b) => {
    const t = (b.textContent || "").trim().toLowerCase();
    return t === "documentation" || t.endsWith(" documentation");
  });
  if (docByText) return docByText;

  return sidebar.querySelector('button[data-action="issues"], button[data-action="support"]');
}

function _createCtsHelpSidebarButton(refBtn) {
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
  return btn;
}

function _injectSidebarHelpInto(docSection) {
  if (!docSection?.appendChild) return;
  if (docSection.querySelector("#cts-dnd-35-help-sidebar")) return;

  const buttons = docSection.querySelectorAll("button");
  const refBtn = buttons.length ? buttons[buttons.length - 1] : null;
  docSection.appendChild(_createCtsHelpSidebarButton(refBtn));
}

function _injectSidebarHelpAfterAnchor(anchor) {
  if (!anchor?.insertAdjacentElement) return;
  if (anchor.nextElementSibling?.id === "cts-dnd-35-help-sidebar") return;

  const refBtn = anchor.tagName === "BUTTON" ? anchor : anchor.querySelector?.("button");
  const btn = _createCtsHelpSidebarButton(refBtn ?? anchor);
  anchor.insertAdjacentElement("afterend", btn);
}

function _tryInjectCtsHelpSidebar() {
  if (document.querySelector("#cts-dnd-35-help-sidebar")) return;

  for (const root of _sidebarRoots()) {
    const strict = _findDocContainerStrict(root);
    if (strict) {
      _injectSidebarHelpInto(strict);
      return;
    }
    const wikiHeading = _findWikiSiblingAfterHelpHeading(root);
    if (wikiHeading) {
      _injectSidebarHelpAfterAnchor(wikiHeading);
      return;
    }
    const anchor = _findLastCoreHelpDocControl(root);
    if (anchor) {
      _injectSidebarHelpAfterAnchor(anchor);
      return;
    }
  }
}

/**
 * Final fallback: locate the visible "Community Wiki" control anywhere and append after it.
 * This survives theme/layout changes where settings containers and hooks differ.
 */
function _tryInjectNearCommunityWikiGlobal() {
  if (document.querySelector("#cts-dnd-35-help-sidebar")) return;
  const candidates = [...document.querySelectorAll("button, a, .button")];
  const wiki = candidates.find((el) => {
    if (!el || el.id === "cts-dnd-35-help-sidebar") return false;
    const t = (el.textContent || "").trim().toLowerCase();
    return t.includes("community") && t.includes("wiki");
  });
  if (!wiki || !wiki.insertAdjacentElement) return;
  _injectSidebarHelpAfterAnchor(wiki);
}

function _injectSidebarHelpButton(html) {
  const el = html instanceof HTMLElement ? html : html?.get?.(0) ?? html?.[0];
  const local = el?.querySelector ? el : null;
  if (local) {
    const docSection = _findHelpDocumentationSectionInRoot(local);
    if (docSection) {
      _injectSidebarHelpInto(docSection);
      return;
    }
  }
  _tryInjectCtsHelpSidebar();
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

let _sidebarObserver = null;
/** @type {() => void} */
let _debouncedInject = () => {};

export function registerInGameHelpHooks() {
  _debouncedInject =
    typeof foundry.utils?.debounce === "function"
      ? foundry.utils.debounce(() => _tryInjectCtsHelpSidebar(), 100)
      : () => _tryInjectCtsHelpSidebar();

  Hooks.on("renderGameSettings", (_app, html) => {
    _injectConfigureSettingsButton(html);
    _injectGameSettingsCategoryHelp(html);
  });
  Hooks.on("renderSettingsConfig", (_app, html) => {
    _injectConfigureSettingsButton(html);
  });

  /* v11: tab id in third arg is unreliable; always re-scan after any sidebar tab render. */
  Hooks.on("renderSidebarTab", (_app, html) => {
    if (html) _injectSidebarHelpButton(html);
    _debouncedInject();
  });

  Hooks.on("renderApplicationV2", (app, element) => {
    const direct = element?.querySelector?.("#settings-documentation");
    if (direct) {
      _injectSidebarHelpInto(direct);
      return;
    }
    if (_isSettingsSidebarTab(app)) _injectSidebarHelpButton(element);
    _debouncedInject();
    _tryInjectNearCommunityWikiGlobal();
  });

  /* Some v14 builds name the hook after the Settings sidebar application. */
  Hooks.on("renderSettings", () => {
    _debouncedInject();
  });

  Hooks.on("changeSidebarTab", () => {
    queueMicrotask(() => _debouncedInject());
    queueMicrotask(() => _tryInjectNearCommunityWikiGlobal());
  });

  Hooks.once("ready", () => {
    if (_sidebarObserver) return;
    const watch = _sidebarRoots()[0] ?? document.getElementById("interface");
    if (!watch) return;
    _sidebarObserver = new MutationObserver(() => _debouncedInject());
    _sidebarObserver.observe(watch, { childList: true, subtree: true });
    queueMicrotask(() => _debouncedInject());
    queueMicrotask(() => _tryInjectNearCommunityWikiGlobal());
    window.setTimeout(() => _tryInjectCtsHelpSidebar(), 500);
    window.setTimeout(() => _tryInjectNearCommunityWikiGlobal(), 600);
    window.setTimeout(() => _tryInjectCtsHelpSidebar(), 2000);
    window.setTimeout(() => _tryInjectNearCommunityWikiGlobal(), 2200);
  });
}
