/**
 * CTS DND 35 — Item Document
 * Extends the base Item class to implement system-specific logic.
 */

export class CTSDND35Item extends Item {

  /** @override */
  prepareData() {
    super.prepareData();
  }

  /**
   * @override
   * Augment the item data with additional dynamic data.
   */
  prepareDerivedData() {
    const itemData = this;
    const systemData = itemData.system;

    // Add type-specific preparation
    if (itemData.type === "spell") this._prepareSpellData(systemData);
    if (itemData.type === "weapon") this._prepareWeaponData(systemData);
    if (itemData.type === "class") this._prepareClassData(systemData);
  }

  /**
   * Prepare spell-specific data
   */
  _prepareSpellData(systemData) {
    // Compute spell save DC placeholder
  }

  /**
   * Prepare weapon-specific data
   */
  _prepareWeaponData(systemData) {
    // Could compute enhancement-adjusted attack/damage here
  }

  /**
   * Prepare class-specific data
   */
  _prepareClassData(systemData) {
    // Could compute BAB, saves from progression tables
  }

  /**
   * Trigger a roll for this item (attack, damage, save, etc.)
   * @param {Event} event   The originating click event
   */
  async roll(event) {
    const item = this;
    const actor = this.actor;

    // If there's no actor, just display the item in chat
    if (!actor) {
      return foundry.documents.BaseChatMessage.create({
        content: `<h2>${item.name}</h2><p>${item.system.description || ""}</p>`,
      });
    }

    const speaker = foundry.documents.BaseChatMessage.getSpeaker({ actor: actor });
    const rollMode = game.settings.get("core", "rollMode");

    // Build a basic chat card
    const content = `
      <div class="cts-dnd-35 chat-card">
        <header class="card-header">
          <img src="${item.img}" width="36" height="36" />
          <h3>${item.name}</h3>
        </header>
        <div class="card-content">
          <p>${item.system.description || ""}</p>
        </div>
      </div>
    `;

    return foundry.documents.BaseChatMessage.create({
      speaker: speaker,
      rollMode: rollMode,
      content: content,
    });
  }
}
