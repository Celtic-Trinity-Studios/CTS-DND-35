/**
 * CTS DND 35 — Item Sheet
 * Extends ItemSheet to display item data.
 */

import { CTSDND35ActorSheet } from "./actor-sheet.mjs";
import { syncActorGroupsFromFactionItems } from "../utils/faction-groups.mjs";

export class CTSDND35ItemSheet extends foundry.appv1.sheets.ItemSheet {

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["cts-dnd-35", "sheet", "item"],
      width: 520,
      height: 480,
      tabs: [
        {
          navSelector: ".sheet-tabs",
          contentSelector: ".sheet-body",
          initial: "description",
        },
      ],
    });
  }

  /** @override */
  get template() {
    return `systems/CTS-DND-35/templates/item/item-${this.item.type}-sheet.hbs`;
  }

  /* -------------------------------------------- */

  /** @override */
  async getData() {
    const context = await super.getData();

    const itemData = this.document.toObject();
    context.system = itemData.system;
    context.flags = itemData.flags;

    // Enrich description HTML
    context.enrichedDescription = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      context.system.description || "",
      { async: true }
    );

    return context;
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    html.on("click", ".cts-faction-refresh-actor-sheets", this._onFactionRefreshActorSheets.bind(this));

    // Everything below here is only for editable sheets
    if (!this.isEditable) return;
  }

  /**
   * Faction item sheet: redraw open CTS actor sheets so faction % / names match the DB
   * (sidebar clicks do not re-fetch sheet data).
   */
  async _onFactionRefreshActorSheets(event) {
    event.preventDefault();
    if (this.item.type !== "faction") return;

    const owner =
      this.item.actor ??
      (this.item.parent?.documentName === "Actor" ? this.item.parent : null);
    if (owner) {
      try {
        await syncActorGroupsFromFactionItems(owner);
      } catch (_err) {
        /* non-fatal */
      }
    }

    let count = 0;
    for (const actor of game.actors ?? []) {
      const sheet = actor.sheet;
      if (!sheet?.rendered) continue;
      const isOurs =
        sheet instanceof CTSDND35ActorSheet || sheet.constructor?.name === "CTSDND35ActorSheet";
      if (!isOurs) continue;
      await sheet.render(false);
      count++;
    }

    ui.notifications?.info(game.i18n.format("CTSDND35.FactionRefreshSheetsDone", { count }));
  }
}
