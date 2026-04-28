/**
 * CTS DND 35 — Main System Entry Point
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

/* -------------------------------------------- */
/*  Hooks: Init                                 */
/* -------------------------------------------- */

Hooks.once("init", function () {
  console.log("CTS DND 35 | Initializing CTS DND 35 System");

  // Expose the system API on the game object
  game.ctsdnd35 = {
    CTSDND35Actor,
    CTSDND35Item,
  };

  // Store config on the global CONFIG object
  CONFIG.CTSDND35 = CTSDND35;

  // Define custom Document classes
  CONFIG.Actor.documentClass = CTSDND35Actor;
  CONFIG.Item.documentClass = CTSDND35Item;

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
    types: ["weapon", "armor", "equipment", "consumable", "feat", "feature", "spell", "class", "race", "buff", "attack"],
    makeDefault: true,
    label: "CTSDND35.SheetItemDefault",
  });

  // Preload Handlebars templates
  return preloadHandlebarsTemplates();
});

/* -------------------------------------------- */
/*  Hooks: Ready                                */
/* -------------------------------------------- */

Hooks.once("ready", function () {
  console.log("CTS DND 35 | System Ready");
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

Handlebars.registerHelper("cts-concat", function () {
  const args = Array.from(arguments);
  args.pop(); // Remove Handlebars options hash
  return args.join("");
});
