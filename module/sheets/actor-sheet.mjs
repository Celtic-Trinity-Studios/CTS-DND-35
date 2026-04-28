/**
 * CTS DND 35 — Actor Sheet
 * Extends ActorSheet to display character / NPC data.
 */

import { CTSDND35 } from "../helpers/config.mjs";
import { CharacterWizard } from "../apps/character-wizard.mjs";
import { LevelUpWizard } from "../apps/level-up-wizard.mjs";

export class CTSDND35ActorSheet extends foundry.appv1.sheets.ActorSheet {

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["cts-dnd-35", "sheet", "actor"],
      width: 720,
      height: 840,
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
    context.system = this.actor.system;
    context.flags = this.actor.flags;

    // Add system config
    context.config = CTSDND35;

    // Organize items by type
    context.items = this._organizeItems(context);

    // Enrich biography HTML
    const enricher = foundry.applications.ux.TextEditor.implementation;
    context.enrichedBiography = await enricher.enrichHTML(
      context.system.details?.biography || "",
      { async: true }
    );
    context.enrichedNotes = await enricher.enrichHTML(
      context.system.details?.notes || "",
      { async: true }
    );

    // Build skill list for the template
    const skillList = [];
    for (const [key, skillDef] of Object.entries(CTSDND35.skills)) {
      const skillData = context.system.skills?.[key] || { ranks: 0, misc: 0, classSkill: false };
      const abilityMod = context.system.abilities?.[skillDef.ability]?.mod || 0;
      skillList.push({
        key,
        label: skillDef.label,
        ability: skillDef.ability.toUpperCase(),
        abilityMod,
        ranks: skillData.ranks || 0,
        misc: skillData.misc || 0,
        total: skillData.total || 0,
        classSkill: skillData.classSkill || false,
        untrained: skillDef.untrained,
      });
    }
    context.skillList = skillList;

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
      const i = item.toObject();
      i.img = i.img || foundry.documents.BaseItem.DEFAULT_ICON;

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

    // Rollable ability checks
    html.on("click", ".ability-roll", this._onAbilityRoll.bind(this));

    // Rollable saves
    html.on("click", ".save-roll", this._onSaveRoll.bind(this));

    // Rollable initiative
    html.on("click", ".init-roll", this._onInitRoll.bind(this));

    // Rollable skills
    html.on("click", ".skill-roll", this._onSkillRoll.bind(this));

    // Rollable item
    html.on("click", ".item-roll", (ev) => {
      ev.preventDefault();
      const li = $(ev.currentTarget).closest(".item");
      const item = this.actor.items.get(li.data("item-id"));
      if (item) item.roll(ev);
    });

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

    // Wizard buttons
    html.find(".open-wizard").click(ev => {
      ev.preventDefault();
      new CharacterWizard(this.actor).render(true);
    });

    html.find(".open-levelup").click(ev => {
      ev.preventDefault();
      new LevelUpWizard(this.actor).render(true);
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
    return await foundry.documents.BaseItem.create(itemData, { parent: this.actor });
  }

  /**
   * Handle ability check rolls.
   */
  async _onAbilityRoll(event) {
    event.preventDefault();
    const ability = event.currentTarget.dataset.ability;
    const abilityData = this.actor.system.abilities[ability];
    const label = CTSDND35.abilities[ability] ?? ability;

    return new foundry.dice.Roll("1d20 + @mod", { mod: abilityData.mod }).toMessage({
      speaker: foundry.documents.BaseChatMessage.getSpeaker({ actor: this.actor }),
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
    const label = CTSDND35.saves[save] ?? save;

    return new foundry.dice.Roll("1d20 + @total", { total: saveData.total }).toMessage({
      speaker: foundry.documents.BaseChatMessage.getSpeaker({ actor: this.actor }),
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

  /**
   * Handle skill check rolls.
   */
  async _onSkillRoll(event) {
    event.preventDefault();
    const skillKey = event.currentTarget.dataset.skill;
    const skillDef = CTSDND35.skills[skillKey];
    const skillData = this.actor.system.skills?.[skillKey];
    if (!skillDef || !skillData) return;

    return new foundry.dice.Roll("1d20 + @total", { total: skillData.total }).toMessage({
      speaker: foundry.documents.BaseChatMessage.getSpeaker({ actor: this.actor }),
      flavor: `${skillDef.label} Check`,
    });
  }
}
