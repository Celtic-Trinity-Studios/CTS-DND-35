/**
 * CTS DND 35 — Actor Sheet
 * Extends ActorSheet to display character / NPC data.
 */

import { CTSDND35 } from "../helpers/config.mjs";

export class CTSDND35ActorSheet extends ActorSheet {

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["CTS-DND-35", "sheet", "actor"],
      width: 720,
      height: 680,
      tabs: [
        {
          navSelector: ".sheet-tabs",
          contentSelector: ".sheet-body",
          initial: "combat",
        },
      ],
    });
  }

  /** @override */
  get template() {
    return `systems/CTS-DND-35/templates/actor/actor-${this.actor.type}-sheet.hbs`;
  }

  /* -------------------------------------------- */

  /** @override */
  async getData() {
    const context = await super.getData();

    // Add the actor's data to context for easier access in templates
    const actorData = this.document.toPlainObject();
    context.system = actorData.system;
    context.flags = actorData.flags;

    // Add system config
    context.config = CTSDND35;

    // Organize items by type
    context.items = this._organizeItems(context);

    // Enrich biography HTML
    context.enrichedBiography = await TextEditor.enrichHTML(
      context.system.details?.biography || "",
      { async: true }
    );
    context.enrichedNotes = await TextEditor.enrichHTML(
      context.system.details?.notes || "",
      { async: true }
    );

    return context;
  }

  /**
   * Organize items into categories for the sheet.
   */
  _organizeItems(context) {
    const items = {
      weapons: [],
      armor: [],
      equipment: [],
      consumables: [],
      feats: [],
      features: [],
      spells: {},
      classes: [],
      attacks: [],
      buffs: [],
    };

    for (const item of this.actor.items) {
      const i = item.toPlainObject();
      i.img = i.img || Item.DEFAULT_ICON;

      switch (i.type) {
        case "weapon": items.weapons.push(i); break;
        case "armor": items.armor.push(i); break;
        case "equipment": items.equipment.push(i); break;
        case "consumable": items.consumables.push(i); break;
        case "feat": items.feats.push(i); break;
        case "feature": items.features.push(i); break;
        case "class": items.classes.push(i); break;
        case "attack": items.attacks.push(i); break;
        case "buff": items.buffs.push(i); break;
        case "spell": {
          const level = i.system.spellLevel || 0;
          if (!items.spells[level]) items.spells[level] = [];
          items.spells[level].push(i);
          break;
        }
      }
    }

    return items;
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Everything below here is only for editable sheets
    if (!this.isEditable) return;

    // Add item
    html.on("click", ".item-create", this._onItemCreate.bind(this));

    // Edit item
    html.on("click", ".item-edit", (ev) => {
      const li = $(ev.currentTarget).closest(".item");
      const item = this.actor.items.get(li.data("item-id"));
      item.sheet.render(true);
    });

    // Delete item
    html.on("click", ".item-delete", (ev) => {
      const li = $(ev.currentTarget).closest(".item");
      const item = this.actor.items.get(li.data("item-id"));
      item.delete();
      li.slideUp(200, () => this.render(false));
    });

    // Rollable ability checks
    html.on("click", ".ability-roll", this._onAbilityRoll.bind(this));

    // Rollable saves
    html.on("click", ".save-roll", this._onSaveRoll.bind(this));

    // Rollable initiative
    html.on("click", ".init-roll", this._onInitRoll.bind(this));

    // Item roll (click name)
    html.on("click", ".item-roll", (ev) => {
      const li = $(ev.currentTarget).closest(".item");
      const item = this.actor.items.get(li.data("item-id"));
      if (item) item.roll(ev);
    });
  }

  /**
   * Handle creating a new embedded Item.
   */
  async _onItemCreate(event) {
    event.preventDefault();
    const header = event.currentTarget;
    const type = header.dataset.type;
    const itemData = {
      name: `New ${type.charAt(0).toUpperCase() + type.slice(1)}`,
      type: type,
      system: {},
    };
    return await Item.create(itemData, { parent: this.actor });
  }

  /**
   * Handle ability check rolls.
   */
  async _onAbilityRoll(event) {
    event.preventDefault();
    const ability = event.currentTarget.dataset.ability;
    const abilityData = this.actor.system.abilities[ability];
    const label = game.i18n.localize(CTSDND35.abilities[ability]) ?? ability;

    return new Roll("1d20 + @mod", { mod: abilityData.mod }).toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: `${label} Check`,
    });
  }

  /**
   * Handle saving throw rolls.
   */
  async _onSaveRoll(event) {
    event.preventDefault();
    const save = event.currentTarget.dataset.save;
    const saveData = this.actor.system.attributes.savingThrows[save];
    const label = game.i18n.localize(CTSDND35.saves[save]) ?? save;

    return new Roll("1d20 + @total", { total: saveData.total }).toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: `${label} Save`,
    });
  }

  /**
   * Handle initiative rolls.
   */
  async _onInitRoll(event) {
    event.preventDefault();
    return this.actor.rollInitiative({ createCombatants: true });
  }
}
