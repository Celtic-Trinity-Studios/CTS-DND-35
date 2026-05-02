/**
 * CTS DND 35 — Item Sheet
 * Extends ItemSheet to display item data.
 */

import { CTSDND35ActorSheet } from "./actor-sheet.mjs";
import { propagateFactionSnapshotToAllActors } from "../utils/faction-propagation.mjs";

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

  /** Merge open sheet inputs into a plain snapshot (Gear % / name may be unsaved). */
  _mergeFactionSnapshotFromSheet() {
    const doc = this.item;
    const snap = {
      name: doc.name,
      img: doc.img,
      system: foundry.utils.deepClone(doc.system ?? {}),
    };
    const root = this.element;
    if (!root?.find) return snap;
    const nameInput = root.find('input[name="name"]');
    if (nameInput.length) {
      const v = nameInput.val();
      if (v !== undefined && v !== null) snap.name = String(v);
    }
    const gearInput = root.find('input[name="system.gearPct"]');
    if (gearInput.length) {
      const raw = gearInput.val();
      const n = raw === "" || raw === undefined ? 0 : Number(raw);
      if (!Number.isNaN(n)) snap.system.gearPct = n;
    }
    return snap;
  }

  /**
   * Persist this faction, push matching copies on every world actor, sync group strings, redraw open CTS sheets.
   */
  async _onFactionRefreshActorSheets(event) {
    event.preventDefault();
    if (this.item.type !== "faction") return;
    if (!game.user?.isGM) {
      ui.notifications?.warn(game.i18n.localize("CTSDND35.FactionRefreshNeedsGM"));
      return;
    }

    const snapshot = this._mergeFactionSnapshotFromSheet();
    const { embeddedUpdated } = await propagateFactionSnapshotToAllActors(this.item, snapshot);

    // Let embedded collections + hooks settle before actor sheets read getData (avoids needing a second click).
    await new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });

    let sheetsRedrawn = 0;
    for (const actor of game.actors ?? []) {
      const sheet = actor.sheet;
      if (!sheet?.rendered) continue;
      const isOurs =
        sheet instanceof CTSDND35ActorSheet || sheet.constructor?.name === "CTSDND35ActorSheet";
      if (!isOurs) continue;
      await sheet.render(false);
      sheetsRedrawn++;
    }

    const actorsTotal = game.actors?.size ?? 0;
    ui.notifications?.info(
      game.i18n.format("CTSDND35.FactionRefreshSheetsDone", {
        embeddedUpdated,
        actorsTotal,
        sheetsRedrawn,
      })
    );
  }
}
