/**
 * CTS DND 35 — Item Sheet
 * Extends ItemSheet to display item data.
 */

const BaseItemSheet = foundry.applications?.sheets?.ItemSheetV2 ?? foundry.appv1.sheets.ItemSheet;

export class CTSDND35ItemSheet extends BaseItemSheet {

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

    // Everything below here is only for editable sheets
    if (!this.isEditable) return;
  }
}
