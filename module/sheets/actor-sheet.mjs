/**
 * CTS DND 3.5 — Actor Sheet
 * Extends ActorSheet to display character / NPC data.
 */

import { applySensesToTokens } from "../hooks/token-combat.mjs";
import { CTSDND35 } from "../helpers/config.mjs";
import { CharacterWizard } from "../apps/character-wizard.mjs";
import { LevelUpWizard } from "../apps/level-up-wizard.mjs";
import { MerchantApp } from "../apps/merchant-app.mjs";

export class CTSDND35ActorSheet extends foundry.appv1.sheets.ActorSheet {

  constructor(object, options = {}) {
    const tabInitial = object.type === "character" ? "main" : "combat";
    super(
      object,
      foundry.utils.mergeObject(options, {
        tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: tabInitial }],
      }),
    );
  }

  /** @override */
  static get defaultOptions() {
    const base = foundry.utils.duplicate(super.defaultOptions);
    return foundry.utils.mergeObject(base, {
      classes: ["cts-dnd-35", "sheet", "actor"],
      width: 720,
      height: 920,
      /**
       * One drop zone on the whole sheet `form` so compendium / sidebar Item drops work on the
       * card header and all tabs (core default used `.sheet-body` only, which misses most of our UI).
       */
      dragDrop: [{ dragSelector: ".item-list .item", dropSelector: "form" }],
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
    if (this.actor.type === "npc") {
      context.system.merchant ??= {
        enabled: false,
        purchaseOnly: false,
        buyMultiplier: 1,
        sellMultiplier: 0.5,
      };
    }

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
        effectBonus: skillData.effectBonus || 0,
        total: skillData.total || 0,
        classSkill: skillData.classSkill || false,
        untrained: skillDef.untrained,
      });
    }
    context.skillList = skillList;

    context.statusConditionRows = CTSDND35.statusConditions.map(({ key, label }) => ({
      key,
      label,
      on: !!(context.system.details?.status?.conditions?.[key]),
    }));

    const spellBuckets = context.items?.spells ?? {};
    context.hasActorSpells = Object.keys(spellBuckets).some((lvl) => (spellBuckets[lvl]?.length ?? 0) > 0);

    context.sheetVisualTheme = game.settings.get("CTS-DND-35", "actorSheetVisualTheme") || "angled";

    context.editable = this.isEditable;

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
      factions: [],
      features: [],
      spells: {},
      classes: [],
      attacks: [],
      buffs: [],
    };

    for (const item of this.actor.items) {
      const i = item.toObject();
      i.img = i.img || foundry.documents.BaseItem.DEFAULT_ICON;
      if (item.system?.derived) {
        i.system ??= {};
        i.system.derived = item.system.derived;
      }

      switch (i.type) {
        case "weapon": items.weapons.push(i); break;
        case "armor": items.armor.push(i); break;
        case "equipment": items.equipment.push(i); break;
        case "consumable": items.consumables.push(i); break;
        case "feat": items.feats.push(i); break;
        case "faction": items.factions.push(i); break;
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

  _normalizeRaceTradeSubmitData(details) {
    if (!details) return;
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
    if (updateData.system?.details) this._normalizeRaceTradeSubmitData(updateData.system.details);
    if (updateData.system?.merchant) this._normalizeMerchantSubmitData(updateData.system.merchant);
    return super._updateObject(event, updateData);
  }

  _normalizeMerchantSubmitData(merchant) {
    if (!merchant || typeof merchant !== "object") return;
    merchant.enabled = merchant.enabled === true || merchant.enabled === "true";
    merchant.purchaseOnly = merchant.purchaseOnly === true || merchant.purchaseOnly === "true";
    if (merchant.buyMultiplier != null) merchant.buyMultiplier = Math.max(0, Number(merchant.buyMultiplier) || 1);
    if (merchant.sellMultiplier != null) merchant.sellMultiplier = Math.max(0, Number(merchant.sellMultiplier) || 0.5);
  }

  /** Buyer for shop UI: controlled token character, else user's assigned character. */
  _resolveMerchantBuyerActor() {
    const controlled = canvas.tokens?.controlled?.[0];
    const fromTok = controlled?.actor;
    if (fromTok?.type === "character") return fromTok;
    const ch = game.user?.character;
    if (ch?.type === "character") return ch;
    return null;
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    const form = this.form;
    if (form && !form.dataset.ctsDragAccept) {
      form.dataset.ctsDragAccept = "1";
      form.addEventListener(
        "dragover",
        (ev) => {
          if (!this.isEditable) return;
          ev.preventDefault();
          try {
            ev.dataTransfer.dropEffect = "copy";
          } catch {
            /* ignore */
          }
        },
        { passive: false },
      );
    }

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

    html.find(".cts-open-merchant-shop").click((ev) => {
      ev.preventDefault();
      if (this.actor.type !== "npc") return;
      const en = this.actor.system?.merchant?.enabled;
      if (!(en === true || en === "true")) {
        ui.notifications.warn(game.i18n.localize("CTSDND35.MerchantErrorNotEnabled"));
        return;
      }
      const buyer = this._resolveMerchantBuyerActor();
      if (!buyer) {
        ui.notifications.warn(game.i18n.localize("CTSDND35.MerchantErrorNoBuyer"));
        return;
      }
      MerchantApp.open(this.actor, buyer);
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

    html.find(".cts-add-temp-hp").click(async (ev) => {
      ev.preventDefault();
      const src = foundry.utils.deepClone(this.actor.system.attributes?.hp?.tempSources ?? []);
      src.push({ label: "", amount: 0 });
      await this.actor.update({ "system.attributes.hp.tempSources": src });
      this.render(false);
    });

    html.on("click", ".cts-slot-spend, .cts-slot-recover", async (ev) => {
      ev.preventDefault();
      if (!this.isEditable) return;
      const key = ev.currentTarget.dataset.classKey;
      const level = String(ev.currentTarget.dataset.level ?? "");
      if (!key || level === "") return;
      const summary = (this.actor.system.spellcasting?.summary || []).find((row) => row.key === key);
      const stored = foundry.utils.deepClone(this.actor.system.spellcasting?.classes?.[key] || {});
      stored.className = stored.className || summary?.className || key;
      stored.type = stored.type || summary?.type || "";
      stored.ability = stored.ability || summary?.ability || "";
      stored.casterLevel = stored.casterLevel ?? summary?.casterLevel ?? 0;
      stored.spellsPerDay = stored.spellsPerDay || {};
      stored.expended = stored.expended || {};
      const current = Math.max(0, Math.floor(Number(stored.expended[level]) || 0));
      const spend = ev.currentTarget.classList.contains("cts-slot-spend");
      stored.expended[level] = spend ? current + 1 : Math.max(0, current - 1);
      await this.actor.update({ [`system.spellcasting.classes.${key}`]: stored });
    });

    html.find(".cts-add-dr").click(async (ev) => {
      ev.preventDefault();
      const rows = foundry.utils.deepClone(this.actor.system.attributes?.dr ?? []);
      rows.push({ amount: 0, bypass: "" });
      await this.actor.update({ "system.attributes.dr": rows });
      this.render(false);
    });

    html.on("click", ".cts-remove-dr", async (ev) => {
      ev.preventDefault();
      const idx = Number(ev.currentTarget.dataset.index);
      const rows = foundry.utils.deepClone(this.actor.system.attributes?.dr ?? []);
      rows.splice(idx, 1);
      await this.actor.update({ "system.attributes.dr": rows });
      this.render(false);
    });

    html.on("click", ".cts-remove-temp-hp", async (ev) => {
      ev.preventDefault();
      const idx = Number(ev.currentTarget.dataset.index);
      const src = foundry.utils.deepClone(this.actor.system.attributes?.hp?.tempSources ?? []);
      src.splice(idx, 1);
      await this.actor.update({ "system.attributes.hp.tempSources": src });
      this.render(false);
    });

    html.on("click", ".cts-aoo-spend", async (ev) => {
      ev.preventDefault();
      const spent = Math.max(0, Math.floor(Number(this.actor.system.attributes?.combat?.aooSpent) || 0));
      await this.actor.update({ "system.attributes.combat.aooSpent": spent + 1 });
    });
    html.on("click", ".cts-aoo-reset", async (ev) => {
      ev.preventDefault();
      await this.actor.update({ "system.attributes.combat.aooSpent": 0 });
    });
    html.on("click", ".cts-turn-undead", (ev) => {
      ev.preventDefault();
      this._onTurnUndead();
    });
    html.on("click", ".cts-concentration", (ev) => {
      ev.preventDefault();
      this._onConcentration();
    });
    html.on("click", ".cts-maneuver", (ev) => {
      ev.preventDefault();
      this._onManeuver(ev.currentTarget.dataset.maneuver);
    });
    html.on("click", ".cts-apply-senses", async (ev) => {
      ev.preventDefault();
      await applySensesToTokens(this.actor);
      ui.notifications.info(`Senses applied for ${this.actor.name}.`);
    });
    html.on("click", ".cts-prepare-plus, .cts-prepare-minus", async (ev) => {
      ev.preventDefault();
      const item = this.actor.items.get(ev.currentTarget.dataset.itemId);
      if (!item) return;
      const current = Math.max(0, Math.floor(Number(item.system.derived?.prepared) || 0));
      const next = ev.currentTarget.classList.contains("cts-prepare-plus") ? current + 1 : Math.max(0, current - 1);
      await item.update({ "system.prepared": next });
    });

    html.on("change", "input[type='checkbox'][data-condition-key]", async (ev) => {
      if (!this.isEditable) return;
      const key = ev.currentTarget.dataset.conditionKey;
      if (!key) return;
      await this.actor.update({ [`system.details.status.conditions.${key}`]: ev.currentTarget.checked });
    });

    html.on("change", "input[type='checkbox'][data-energy-immune]", async (ev) => {
      if (!this.isEditable) return;
      const key = ev.currentTarget.dataset.energyImmune;
      if (!key) return;
      await this.actor.update({ [`system.attributes.energy.immune.${key}`]: ev.currentTarget.checked });
    });

    html.on("click", ".cts-status-subtabs [data-cts-status-sub]", (ev) => {
      ev.preventDefault();
      const sub = ev.currentTarget.dataset.ctsStatusSub;
      if (!sub) return;
      const root = ev.currentTarget.closest(".cts-status-panel");
      if (!root) return;
      root.querySelectorAll(".cts-status-subtabs [data-cts-status-sub]").forEach((el) => {
        el.classList.toggle("active", el === ev.currentTarget);
      });
      root.querySelectorAll(".cts-status-subpane").forEach((pane) => {
        pane.classList.toggle("is-active", pane.dataset.ctsStatusSub === sub);
      });
    });
  }

  async _onTurnUndead() {
    const turning = this.actor.system.attributes?.turning || {};
    const cha = this.actor.system.abilities?.cha?.mod || 0;
    const speaker = foundry.documents.BaseChatMessage.getSpeaker({ actor: this.actor });
    if (!turning.pool) {
      ui.notifications.warn(`${this.actor.name} has no turn undead uses.`);
      return;
    }
    const check = new foundry.dice.Roll(`1d20 + ${cha}`);
    const damage = new foundry.dice.Roll(`2d6 + ${Math.floor(turning.level || 0) + cha}`);
    await check.evaluate();
    await damage.evaluate();
    const spent = Math.max(0, Math.floor(Number(turning.expended) || 0)) + 1;
    await this.actor.update({ "system.attributes.turning.expended": spent });
    return foundry.documents.BaseChatMessage.create({
      speaker,
      rolls: [check, damage],
      flavor: "Turn undead",
      content: `<div class="cts-dnd-35 chat-card"><h3>Turn undead</h3><p>Check <strong>${check.total}</strong> · damage <strong>${damage.total}</strong></p><p>Uses left after this: ${Math.max(0, (turning.pool || 0) - spent)}</p></div>`,
    });
  }

  async _onConcentration() {
    const skill = Math.floor(Number(this.actor.system.skills?.con?.total) || 0);
    const dc = Math.floor(Number(this.actor.system.attributes?.combat?.concentrationDc) || 0);
    const roll = new foundry.dice.Roll(`1d20 + ${skill}`);
    await roll.evaluate();
    return roll.toMessage({
      speaker: foundry.documents.BaseChatMessage.getSpeaker({ actor: this.actor }),
      flavor: `Concentration vs DC ${dc} — ${roll.total >= dc ? "success" : "failure"}`,
    });
  }

  async _onManeuver(kind) {
    const system = this.actor.system;
    const bab = Math.floor(Number(system.attributes?.bab?.total) || 0);
    const str = Math.floor(Number(system.abilities?.str?.mod) || 0);
    const sizeKey = system.traits?.size || "med";
    const size = CTSDND35.sizeMods[sizeKey] || CTSDND35.sizeMods.med;
    const penalty = Math.floor(Number(system.attributes?.attackRollPenalty) || 0);
    const speaker = foundry.documents.BaseChatMessage.getSpeaker({ actor: this.actor });
    const rolls = [];
    const lines = [];
    if (kind === "bullrush") {
      const roll = new foundry.dice.Roll(`1d20 + ${str + (size.grapple || 0)}`);
      await roll.evaluate();
      rolls.push(roll);
      lines.push(`Bull rush (opposed Strength): <strong>${roll.total}</strong>`);
    } else {
      const attack = new foundry.dice.Roll(`1d20 + ${bab + str + (size.attack || 0) - penalty}`);
      await attack.evaluate();
      rolls.push(attack);
      const label = kind === "trip" ? "Trip touch" : kind === "disarm" ? "Disarm" : "Sunder";
      lines.push(`${label}: <strong>${attack.total}</strong>`);
      if (kind === "trip") {
        const oppose = new foundry.dice.Roll(`1d20 + ${str}`);
        await oppose.evaluate();
        rolls.push(oppose);
        lines.push(`Opposed Strength: <strong>${oppose.total}</strong>`);
      }
    }
    return foundry.documents.BaseChatMessage.create({
      speaker,
      rolls,
      flavor: kind,
      content: `<div class="cts-dnd-35 chat-card"><h3>${kind}</h3>${lines.map((line) => `<p>${line}</p>`).join("")}</div>`,
    });
  }

  /**
   * Handle ability check rolls.
   */
  async _onAbilityRoll(event) {
    event.preventDefault();
    const ability = event.currentTarget.dataset.ability;
    const abilityData = this.actor.system.abilities[ability];
    const label = CTSDND35.abilities[ability] ?? ability;

    const penalty = Math.floor(Number(this.actor.system.attributes?.abilityCheckPenalty) || 0);
    return new foundry.dice.Roll("1d20 + @mod", { mod: (abilityData.mod || 0) - penalty }).toMessage({
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
