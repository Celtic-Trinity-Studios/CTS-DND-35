/**
 * CTS DND 3.5 — Main System Entry Point
 * A custom D&D 3.5 Edition system for Foundry VTT
 * by Celtic Trinity Studios
 */

// Import document classes
import { CTSDND35Actor } from "./documents/actor.mjs";
import { CTSDND35Item } from "./documents/item.mjs";

// Import sheet classes
import { CTSDND35ActorSheet } from "./sheets/actor-sheet.mjs";
import { CTSDND35ItemSheet } from "./sheets/item-sheet.mjs";

// Import helpers
import { CTSDND35 } from "./helpers/config.mjs";
import { preloadHandlebarsTemplates } from "./helpers/templates.mjs";
import { registerActorFactionGroupHooks } from "./hooks/actor-faction-groups.mjs";
import { registerCtsSidebarTabs } from "./sidebar/cts-sidebar-tabs.mjs";
import { registerActorCharacterMechanicsHooks } from "./hooks/actor-character-mechanics.mjs";
import { registerMerchantSockets } from "./hooks/merchant-socket.mjs";
import { MerchantApp } from "./apps/merchant-app.mjs";
import { CTSDND35HelpApp } from "./apps/help-app.mjs";
import { CTSDND35HelpMenuApp } from "./apps/help-menu-app.mjs";
import { registerInGameHelpHooks } from "./hooks/help-ui.mjs";
import { getItemAndActorFromHookArgs } from "./utils/item-hook-args.mjs";
import { isFactionBulkPushActive } from "./utils/faction-bulk-push-guard.mjs";
import { adjustedGearPrice, computeGearPricePercentTotal } from "./utils/trade-modifiers.mjs";

function _getD35DiagonalRuleValue() {
  const diagonalRules = foundry?.CONST?.GRID_DIAGONALS ?? CONST?.GRID_DIAGONALS ?? {};
  return (
    diagonalRules.ALTERNATING_1 ??
    diagonalRules.ALTERNATING_2 ??
    diagonalRules.ALTERNATING ??
    diagonalRules.DND35 ??
    diagonalRules["5-10-5"] ??
    "5105"
  );
}

function _buildFiveFootGridPatch(source) {
  const patch = {};
  const grid = foundry.utils.deepClone(source?.grid ?? {});
  let changed = false;

  if (Number(grid.distance) !== 5) {
    grid.distance = 5;
    changed = true;
  }
  if (String(grid.units ?? "").toLowerCase() !== "ft") {
    grid.units = "ft";
    changed = true;
  }
  if (changed) patch.grid = grid;

  // Compatibility for scenes still using legacy keys.
  if (source && Object.prototype.hasOwnProperty.call(source, "gridDistance") && Number(source.gridDistance) !== 5) {
    patch.gridDistance = 5;
  }
  if (source && Object.prototype.hasOwnProperty.call(source, "gridUnits") && String(source.gridUnits ?? "").toLowerCase() !== "ft") {
    patch.gridUnits = "ft";
  }

  return Object.keys(patch).length ? patch : null;
}

/* -------------------------------------------- */
/*  Hooks: Init                                 */
/* -------------------------------------------- */

Hooks.once("init", function () {
  console.log("CTS DND 3.5 | Initializing CTS DND 3.5 System");

  // Expose the system API on the game object
  game.ctsdnd35 = {
    CTSDND35Actor,
    CTSDND35Item,
    computeGearPricePercentTotal,
    adjustedGearPrice,
    openMerchantShop: (merchant, buyer) => MerchantApp.open(merchant, buyer),
    openHelp: () => CTSDND35HelpApp.open(),
  };

  registerMerchantSockets();
  registerInGameHelpHooks();

  // Store config on the global CONFIG object
  CONFIG.CTSDND35 = CTSDND35;

  // Define custom Document classes
  CONFIG.Actor.documentClass = CTSDND35Actor;
  CONFIG.Item.documentClass = CTSDND35Item;

  CONFIG.Item.typeLabels = foundry.utils.mergeObject(CONFIG.Item.typeLabels ?? {}, {
    faction: game.i18n.localize("CTSDND35.ItemTypeFaction"),
  });

  registerCtsSidebarTabs();

  // System settings
  game.settings.register("CTS-DND-35", "enableGestalt", {
    name: "Enable Gestalt Character Creation",
    hint: "Allow selecting and allocating a secondary class in the Character Wizard.",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
  });

  game.settings.register("CTS-DND-35", "actorSheetVisualTheme", {
    name: game.i18n.localize("CTSDND35.ActorSheetVisualTheme"),
    hint: game.i18n.localize("CTSDND35.ActorSheetVisualThemeHint"),
    scope: "client",
    config: true,
    type: String,
    choices: {
      classic: game.i18n.localize("CTSDND35.SheetThemeClassic"),
      angled: game.i18n.localize("CTSDND35.SheetThemeAngled"),
    },
    default: "angled",
    onChange: () => {
      if (!game.actors) return;
      for (const actor of game.actors) {
        const sheet = actor.sheet;
        if (sheet?.rendered && sheet instanceof CTSDND35ActorSheet) sheet.render(false);
      }
    },
  });

  game.settings.register("CTS-DND-35", "enforceFiveFootSquares", {
    name: "Enforce 5-foot square grid",
    hint: "Automatically keeps scene grid distance at 5 and units at ft for D&D 3.5 movement scale.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  });

  game.settings.register("CTS-DND-35", "enforceD35Diagonals", {
    name: "Use D&D 3.5 diagonal movement (5-10-5)",
    hint: "Sets Foundry's diagonal movement rule to alternating 5/10 feet (3.5 standard).",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  });

  game.settings.registerMenu("CTS-DND-35", "systemHelp", {
    name: game.i18n.localize("CTSDND35.Help.MenuName"),
    label: game.i18n.localize("CTSDND35.Help.MenuLabel"),
    hint: game.i18n.localize("CTSDND35.Help.MenuHint"),
    icon: "fas fa-book-open",
    type: CTSDND35HelpMenuApp,
    restricted: false,
  });

  // Register Actor sheet application classes
  foundry.documents.collections.Actors.unregisterSheet("core", foundry.appv1.sheets.ActorSheet);
  foundry.documents.collections.Actors.registerSheet("CTS-DND-35", CTSDND35ActorSheet, {
    types: ["character", "npc"],
    makeDefault: true,
    label: "CTSDND35.SheetActorDefault",
  });

  // Register Item sheet application classes
  foundry.documents.collections.Items.unregisterSheet("core", foundry.appv1.sheets.ItemSheet);
  foundry.documents.collections.Items.registerSheet("CTS-DND-35", CTSDND35ItemSheet, {
    types: ["weapon", "armor", "equipment", "consumable", "feat", "feature", "spell", "class", "race", "buff", "attack", "faction"],
    makeDefault: true,
    label: "CTSDND35.SheetItemDefault",
  });

  Hooks.on("preCreateItem", (_document, data) => {
    if (data.type !== "faction") return;
    data.img = data.img || "icons/svg/star.svg";
    data.system = foundry.utils.mergeObject({ description: "", gearPct: 0 }, data.system ?? {});
  });

  registerActorFactionGroupHooks();
  registerActorCharacterMechanicsHooks();

  Hooks.on("updateItem", (first, second) => {
    if (isFactionBulkPushActive()) return;
    const { item, actor } = getItemAndActorFromHookArgs(first, second);
    const owner = actor ?? item?.actor ?? (item?.parent?.documentName === "Actor" ? item.parent : null);
    if (!item || (item.type !== "faction" && item.type !== "feat")) return;
    if (!owner?.sheet?.rendered || !(owner.sheet instanceof CTSDND35ActorSheet)) return;
    queueMicrotask(() => owner.sheet.render(false));
  });

  // Preload Handlebars templates
  return preloadHandlebarsTemplates();
});

/* -------------------------------------------- */
/*  Hooks: Ready                                */
/* -------------------------------------------- */

Hooks.once("ready", async function () {
  console.log("CTS DND 3.5 | System Ready");

  CONFIG.Item.typeLabels = foundry.utils.mergeObject(CONFIG.Item.typeLabels ?? {}, {
    faction: game.i18n.localize("CTSDND35.ItemTypeFaction"),
  });

  if (!game.user?.isGM) return;

  if (game.settings.get("CTS-DND-35", "enforceD35Diagonals")) {
    try {
      await game.settings.set("core", "gridDiagonals", _getD35DiagonalRuleValue());
    } catch (err) {
      console.warn("CTS DND 3.5 | Unable to set core diagonal movement rule.", err);
    }
  }

  if (game.settings.get("CTS-DND-35", "enforceFiveFootSquares")) {
    for (const scene of game.scenes ?? []) {
      const patch = _buildFiveFootGridPatch(scene.toObject());
      if (!patch) continue;
      try {
        await scene.update(patch);
      } catch (err) {
        console.warn(`CTS DND 3.5 | Unable to update grid scale for scene ${scene.name}.`, err);
      }
    }
  }
});

Hooks.on("preCreateScene", function (_scene, createData) {
  if (!game.settings.get("CTS-DND-35", "enforceFiveFootSquares")) return;
  const patch = _buildFiveFootGridPatch(createData);
  if (patch) foundry.utils.mergeObject(createData, patch);
});

Hooks.on("preUpdateScene", function (scene, changedData) {
  if (!game.settings.get("CTS-DND-35", "enforceFiveFootSquares")) return;
  const nextData = foundry.utils.mergeObject(scene.toObject(), changedData, { inplace: false });
  const patch = _buildFiveFootGridPatch(nextData);
  if (patch) foundry.utils.mergeObject(changedData, patch);
});

/* -------------------------------------------- */
/*  Handlebars Helpers                          */
/* -------------------------------------------- */

Handlebars.registerHelper("cts-mod", function (value) {
  const mod = Math.floor((value - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
});

Handlebars.registerHelper("cts-sign", function (value) {
  return value >= 0 ? `+${value}` : `${value}`;
});

Handlebars.registerHelper("cts-eq", function (a, b) {
  return a === b;
});

Handlebars.registerHelper("cts-or", function () {
  const args = Array.from(arguments);
  args.pop(); // Remove Handlebars options hash
  return args.some(Boolean);
});

Handlebars.registerHelper("cts-fixed2", function (value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
});

