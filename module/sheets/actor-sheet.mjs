/**
 * CTS DND 35 — Actor Sheet
 * Extends ActorSheet to display character / NPC data.
 */

import { CTSDND35 } from "../helpers/config.mjs";
import { CharacterWizard } from "../apps/character-wizard.mjs";
import { LevelUpWizard } from "../apps/level-up-wizard.mjs";
import { parseGroupTokens } from "../utils/faction-groups.mjs";

export class CTSDND35ActorSheet extends foundry.appv1.sheets.ActorSheet {

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["cts-dnd-35", "sheet", "actor"],
      width: 720,
      height: 920,
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
    context.factionAffiliations = this._factionRowsForDisplay(this.actor);
    context.raceTradeMods = this._raceTradeRowsForDisplay(this.actor);
    context.raceModsSelling = this._raceModsSellingForDisplay(this.actor);

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

    context.sheetVisualTheme = game.settings.get("CTS-DND-35", "actorSheetVisualTheme") || "angled";

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

  _factionRowsForDisplay(actor) {
    const stored = actor.system?.details?.factionAffiliations;
    let rows;
    if (Array.isArray(stored) && stored.length) {
      rows = stored.map((r) => ({
        name: r?.name ?? "",
        gearPct: Number(r?.gearPct) || 0,
        notes: r?.notes ?? "",
      }));
    } else {
      rows = parseGroupTokens(actor.system?.details?.groups || "").map((name) => ({
        name,
        gearPct: 0,
        notes: "",
      }));
    }
    if (!rows.length) rows.push({ name: "", gearPct: 0, notes: "" });
    return rows;
  }

  _raceTradeRowsForDisplay(actor) {
    const stored = actor.system?.details?.raceTradeMods;
    if (!Array.isArray(stored) || !stored.length) return [{ race: "", tradePct: 0, notes: "" }];
    const rows = stored.map((r) => ({
      race: r?.race ?? "",
      tradePct: Number(r?.tradePct) || 0,
      notes: r?.notes ?? "",
    }));
    return rows.length ? rows : [{ race: "", tradePct: 0, notes: "" }];
  }

  _raceModsSellingForDisplay(actor) {
    const stored = actor.system?.details?.raceModsSelling;
    if (!Array.isArray(stored) || !stored.length) return [{ race: "", tradePct: 0, notes: "" }];
    const rows = stored.map((r) => ({
      race: r?.race ?? "",
      tradePct: Number(r?.tradePct) || 0,
      notes: r?.notes ?? "",
    }));
    return rows.length ? rows : [{ race: "", tradePct: 0, notes: "" }];
  }

  _normalizeFactionSubmitData(details) {
    if (!details) return;
    let fa = details.factionAffiliations;
    if (fa && typeof fa === "object" && !Array.isArray(fa)) {
      fa = Object.keys(fa)
        .sort((a, b) => Number(a) - Number(b))
        .map((k) => fa[k]);
    }
    if (Array.isArray(fa)) {
      details.factionAffiliations = fa
        .map((r) => ({
          name: String(r?.name ?? "").trim(),
          gearPct: Number(r?.gearPct) || 0,
          notes: String(r?.notes ?? "").trim(),
        }))
        .filter((r) => r.name.length > 0 || r.gearPct !== 0 || r.notes.length > 0);
      details.groups = details.factionAffiliations.map((r) => r.name).filter(Boolean).join(", ");
    }
    let rm = details.raceTradeMods;
    if (rm && typeof rm === "object" && !Array.isArray(rm)) {
      rm = Object.keys(rm)
        .sort((a, b) => Number(a) - Number(b))
        .map((k) => rm[k]);
    }
    if (Array.isArray(rm)) {
      details.raceTradeMods = rm
        .map((r) => ({
          race: String(r?.race ?? "").trim(),
          tradePct: Number(r?.tradePct) || 0,
          notes: String(r?.notes ?? "").trim(),
        }))
        .filter((r) => r.race.length > 0 || r.tradePct !== 0 || r.notes.length > 0);
    }
    let ms = details.raceModsSelling;
    if (ms && typeof ms === "object" && !Array.isArray(ms)) {
      ms = Object.keys(ms)
        .sort((a, b) => Number(a) - Number(b))
        .map((k) => ms[k]);
    }
    if (Array.isArray(ms)) {
      details.raceModsSelling = ms
        .map((r) => ({
          race: String(r?.race ?? "").trim(),
          tradePct: Number(r?.tradePct) || 0,
          notes: String(r?.notes ?? "").trim(),
        }))
        .filter((r) => r.race.length > 0 || r.tradePct !== 0 || r.notes.length > 0);
    }
  }

  /** @override */
  async _updateObject(event, formData) {
    const updateData =
      formData && typeof formData === "object" && formData.system !== undefined
        ? foundry.utils.deepClone(formData)
        : foundry.utils.expandObject(formData);
    if (updateData.system?.details) this._normalizeFactionSubmitData(updateData.system.details);
    return super._updateObject(event, updateData);
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

    html.find(".cts-add-faction-row").click(async (ev) => {
      ev.preventDefault();
      let rows = [...(this.actor.system.details?.factionAffiliations || [])];
      if (!rows.length) {
        rows = parseGroupTokens(this.actor.system.details?.groups || "").map((name) => ({
          name,
          gearPct: 0,
          notes: "",
        }));
      }
      rows.push({ name: "", gearPct: 0, notes: "" });
      await this.actor.update({
        "system.details.factionAffiliations": rows,
        "system.details.groups": rows.map((r) => r.name).filter(Boolean).join(", "),
      });
      this.render(false);
    });

    html.find(".cts-remove-faction-row").click(async (ev) => {
      ev.preventDefault();
      const idx = Number(ev.currentTarget.dataset.index);
      let rows = [...(this.actor.system.details?.factionAffiliations || [])];
      if (!rows.length) {
        rows = parseGroupTokens(this.actor.system.details?.groups || "").map((name) => ({
          name,
          gearPct: 0,
          notes: "",
        }));
      }
      rows.splice(idx, 1);
      await this.actor.update({
        "system.details.factionAffiliations": rows,
        "system.details.groups": rows.map((r) => r.name).filter(Boolean).join(", "),
      });
      this.render(false);
    });

    html.find(".cts-add-race-trade-row").click(async (ev) => {
      ev.preventDefault();
      const rows = [...(this.actor.system.details?.raceTradeMods || [])];
      rows.push({ race: "", tradePct: 0, notes: "" });
      await this.actor.update({ "system.details.raceTradeMods": rows });
      this.render(false);
    });

    html.find(".cts-remove-race-trade-row").click(async (ev) => {
      ev.preventDefault();
      const idx = Number(ev.currentTarget.dataset.index);
      const rows = [...(this.actor.system.details?.raceTradeMods || [])];
      rows.splice(idx, 1);
      await this.actor.update({ "system.details.raceTradeMods": rows });
      this.render(false);
    });

    html.find(".cts-add-race-selling-row").click(async (ev) => {
      ev.preventDefault();
      const rows = [...(this.actor.system.details?.raceModsSelling || [])];
      rows.push({ race: "", tradePct: 0, notes: "" });
      await this.actor.update({ "system.details.raceModsSelling": rows });
      this.render(false);
    });

    html.find(".cts-remove-race-selling-row").click(async (ev) => {
      ev.preventDefault();
      const idx = Number(ev.currentTarget.dataset.index);
      const rows = [...(this.actor.system.details?.raceModsSelling || [])];
      rows.splice(idx, 1);
      await this.actor.update({ "system.details.raceModsSelling": rows });
      this.render(false);
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
