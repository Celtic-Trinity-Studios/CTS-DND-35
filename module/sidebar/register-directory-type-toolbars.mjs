import { pruneLegacyCtsSidebarTabEntries } from "./directory-type-toolbars-shared.mjs";
import { registerItemsDirectoryTypeToolbar, cleanupItemsDirectoryTypeToolbar } from "./items-directory-type-rail.mjs";
import { registerActorsDirectoryTypeToolbar, cleanupActorsDirectoryTypeToolbar } from "./actors-directory-type-toolbar.mjs";
import { registerMacrosDirectoryTypeToolbar, cleanupMacrosDirectoryTypeToolbar } from "./macros-directory-type-toolbar.mjs";
import { registerScenesDirectoryTypeToolbar, cleanupScenesDirectoryTypeToolbar } from "./scenes-directory-type-toolbar.mjs";
import { tagWorldItemDirectoryRows } from "./world-item-directory-rows.mjs";
import { tagWorldActorDirectoryRows } from "./world-actor-directory-rows.mjs";
import { tagWorldMacroDirectoryRows } from "./world-macro-directory-rows.mjs";
import { tagWorldSceneDirectoryRows } from "./world-scene-directory-rows.mjs";

let _settingRegistered = false;
let _refreshHooks = false;
let _readyPrune = false;

function refreshAllDirectoryTags() {
  queueMicrotask(() => {
    requestAnimationFrame(() => {
      if (ui?.items?.element) tagWorldItemDirectoryRows(ui.items.element);
      if (ui?.actors?.element) tagWorldActorDirectoryRows(ui.actors.element);
      if (ui?.macros?.element) tagWorldMacroDirectoryRows(ui.macros.element);
      if (ui?.scenes?.element) tagWorldSceneDirectoryRows(ui.scenes.element);
    });
  });
}

function registerDirectoryTypeToolbarsSetting() {
  if (_settingRegistered) return;
  _settingRegistered = true;

  game.settings.register("CTS-DND-35", "directoryTypeToolbars", {
    name: game.i18n.localize("CTSDND35.DirectoryTypeToolbarsName"),
    hint: game.i18n.localize("CTSDND35.DirectoryTypeToolbarsHint"),
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
    onChange: (enabled) => {
      if (enabled === false) {
        cleanupItemsDirectoryTypeToolbar();
        cleanupActorsDirectoryTypeToolbar();
        cleanupMacrosDirectoryTypeToolbar();
        cleanupScenesDirectoryTypeToolbar();
      }
      queueMicrotask(() => {
        ui?.items?.render?.(false);
        ui?.actors?.render?.(false);
        ui?.macros?.render?.(false);
        ui?.scenes?.render?.(false);
      });
    },
  });
}

function registerWorldDocumentRefreshHooks() {
  if (_refreshHooks) return;
  _refreshHooks = true;

  const skipEmb = (doc) => !doc || doc.isEmbedded;
  for (const evt of ["createItem", "deleteItem", "updateItem"]) {
    Hooks.on(evt, (doc) => {
      if (!skipEmb(doc)) refreshAllDirectoryTags();
    });
  }
  for (const evt of ["createActor", "deleteActor", "updateActor"]) {
    Hooks.on(evt, (doc) => {
      if (!skipEmb(doc)) refreshAllDirectoryTags();
    });
  }
  for (const evt of ["createMacro", "deleteMacro", "updateMacro"]) {
    Hooks.on(evt, () => refreshAllDirectoryTags());
  }
  for (const evt of ["createScene", "deleteScene", "updateScene"]) {
    Hooks.on(evt, () => refreshAllDirectoryTags());
  }
}

/** One client toggle + in-panel chips for Items, Actors, Macros, and Scenes directories. */
export function registerDirectoryTypeToolbars() {
  pruneLegacyCtsSidebarTabEntries();
  registerDirectoryTypeToolbarsSetting();
  registerItemsDirectoryTypeToolbar();
  registerActorsDirectoryTypeToolbar();
  registerMacrosDirectoryTypeToolbar();
  registerScenesDirectoryTypeToolbar();
  registerWorldDocumentRefreshHooks();

  if (!_readyPrune) {
    _readyPrune = true;
    Hooks.once("ready", () => {
      pruneLegacyCtsSidebarTabEntries();
      try {
        ui?.sidebar?.render?.(false);
      } catch {
        /* ignore */
      }
    });
  }
}
