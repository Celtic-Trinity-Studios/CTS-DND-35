/**
 * Client setting `directoryTypeToolbars` defaults to true, but `game.settings.get`
 * can be `undefined` before the client schema hydrates — never treat that as "off".
 */
export function isDirectoryTypeToolbarsEnabled() {
  const v = game.settings?.get?.("CTS-DND-35", "directoryTypeToolbars");
  return v !== false;
}

/** Remove legacy CTS tab entries if they linger (hot reload / cached merge). */
export function pruneLegacyCtsSidebarTabEntries() {
  try {
    const T = foundry?.applications?.sidebar?.Sidebar?.TABS;
    if (T && typeof T === "object") {
      delete T.ctsNpcs;
      delete T.ctsSpells;
      delete T.ctsFactions;
    }
    if (CONFIG.ui && typeof CONFIG.ui === "object") {
      delete CONFIG.ui.ctsNpcs;
      delete CONFIG.ui.ctsSpells;
      delete CONFIG.ui.ctsFactions;
    }
  } catch {
    /* ignore */
  }
}
