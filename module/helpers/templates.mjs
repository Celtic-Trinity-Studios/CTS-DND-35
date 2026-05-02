/**
 * CTS DND 35 — Handlebars Template Preloading
 * Define a set of template paths to pre-load.
 * Pre-loaded templates are compiled and cached for fast access when rendering.
 */

export const preloadHandlebarsTemplates = async function () {
  return foundry.applications.handlebars.loadTemplates([
    // Actor partials
    "systems/CTS-DND-35/templates/actor/parts/actor-abilities.hbs",
    "systems/CTS-DND-35/templates/actor/parts/actor-combat.hbs",
    "systems/CTS-DND-35/templates/actor/parts/actor-features.hbs",
    "systems/CTS-DND-35/templates/actor/parts/actor-inventory.hbs",
    "systems/CTS-DND-35/templates/actor/parts/actor-spells.hbs",
    "systems/CTS-DND-35/templates/actor/parts/actor-skills.hbs",
    "systems/CTS-DND-35/templates/actor/parts/actor-biography.hbs",
    "systems/CTS-DND-35/templates/actor/parts/actor-factions-relations.hbs",
  ]);
};
