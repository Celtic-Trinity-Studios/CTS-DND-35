/**
 * Resolve the directory DOM root from ApplicationV2 `render*` hook args.
 * `app.element` is sometimes unset when the hook runs; Foundry may pass jQuery-wrapped `html`.
 * @param {unknown} app
 * @param {unknown} html
 * @returns {HTMLElement|null}
 */
export function sidebarDirectoryRootFromRenderArgs(app, html) {
  const el = app?.element;
  if (el instanceof HTMLElement) return el;
  if (html instanceof HTMLElement) return html;
  if (html?.jquery && html[0] instanceof HTMLElement) return html[0];
  return null;
}
