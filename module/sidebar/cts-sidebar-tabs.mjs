/**
 * Sidebar directory UX entry point. Forwards to the unified toolbar registrar.
 */
import { pruneLegacyCtsSidebarTabEntries } from "./directory-type-toolbars-shared.mjs";
import { registerDirectoryFilterToolbars } from "./directory-filter-toolbars.mjs";

export function registerCtsSidebarTabs() {
  pruneLegacyCtsSidebarTabEntries();
  registerDirectoryFilterToolbars();
}
