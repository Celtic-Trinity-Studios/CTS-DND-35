/**
 * CTS DND 35 — Actor Document
 * Extends the base Actor class to implement system-specific logic.
 */

export class CTSDND35Actor extends Actor {

  /** @override */
  prepareData() {
    // Call parent prepareData which calls prepareBaseData and prepareDerivedData
    super.prepareData();
  }

  /** @override */
  prepareBaseData() {
    // Data modifications that should happen before items are prepared
  }

  /**
   * @override
   * Compute derived data after items and effects are applied.
   */
  prepareDerivedData() {
    const actorData = this;
    const systemData = actorData.system;
    const flags = actorData.flags.ctsdnd35 || {};

    // Compute ability modifiers
    this._prepareAbilities(systemData);

    // Route based on actor type
    if (actorData.type === "character") this._prepareCharacterData(actorData, systemData);
    if (actorData.type === "npc") this._prepareNpcData(actorData, systemData);

    // Compute combat stats
    this._prepareCombatStats(systemData);
  }

  /**
   * Calculate ability modifiers from ability scores.
   * @param {object} systemData
   */
  _prepareAbilities(systemData) {
    for (const [key, ability] of Object.entries(systemData.abilities)) {
      ability.mod = Math.floor((ability.value - 10) / 2);
    }
  }

  /**
   * Prepare Character-specific derived data.
   */
  _prepareCharacterData(actorData, systemData) {
    // Compute total level from class items
    const classItems = actorData.items.filter(i => i.type === "class");
    let totalLevel = 0;
    for (const cls of classItems) {
      totalLevel += cls.system.level || 0;
    }
    systemData.details.level.value = totalLevel;
  }

  /**
   * Prepare NPC-specific derived data.
   */
  _prepareNpcData(actorData, systemData) {
    // Derive XP from CR if desired
  }

  /**
   * Calculate saving throws, initiative, AC, and other combat stats.
   */
  _prepareCombatStats(systemData) {
    const saves = systemData.attributes.savingThrows;
    for (const [key, save] of Object.entries(saves)) {
      const abilityMod = systemData.abilities[save.ability]?.mod || 0;
      save.total = save.base + abilityMod + (save.bonus || 0);
    }

    // Initiative
    systemData.attributes.init.total =
      (systemData.abilities.dex?.mod || 0) +
      (systemData.attributes.init.bonus || 0);

    // Grapple = BAB + STR mod + size mod (placeholder for size)
    systemData.attributes.grapple.total =
      (systemData.attributes.bab?.total || 0) +
      (systemData.abilities.str?.mod || 0);
  }

  /**
   * Override getRollData() to inject system data into roll formulas.
   */
  getRollData() {
    const data = { ...super.getRollData() };

    // Copy ability scores and mods to top level for convenience
    if (data.abilities) {
      for (const [k, v] of Object.entries(data.abilities)) {
        data[`abl_${k}`] = v.value;
        data[`mod_${k}`] = v.mod;
      }
    }

    return data;
  }
}
