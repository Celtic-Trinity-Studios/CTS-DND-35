/**
 * CTS DND 3.5 — Item Document
 * Extends the base Item class to implement system-specific logic.
 */

import { applyEnergyToDamage, resolveClassCombatProgression } from "../helpers/combat-rules.mjs";

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

    systemData.quantity ??= 1;
    systemData.weight ??= 0;

    if (itemData.type === "buff") {
      systemData.active = systemData.active === true || systemData.active === "true";
      systemData.modifiers ??= {};
    }

    if (itemData.type === "armor") {
      systemData.equipped = systemData.equipped === true || systemData.equipped === "true";
      systemData.acBonus ??= 0;
      systemData.enhancement ??= 0;
      systemData.armorType ??= "light";
      if (systemData.speedPenalty === undefined) systemData.speedPenalty = null;
      if (systemData.checkPenalty == null || systemData.checkPenalty === "") {
        systemData.checkPenalty = systemData.acp ?? 0;
      }
      if (systemData.arcaneSpellFailure == null || systemData.arcaneSpellFailure === "") {
        systemData.arcaneSpellFailure = systemData.spellFailure ?? 0;
      }
    }

    if (itemData.type === "weapon" || itemData.type === "attack") this._prepareWeaponData(systemData);
    if (itemData.type === "class") this._prepareClassData(systemData);
    if (itemData.type === "spell") this._prepareSpellData(systemData);
  }

  _prepareSpellData(systemData) {
    systemData.spellLevel = Math.max(0, Math.floor(Number(systemData.spellLevel) || 0));
    systemData.school ??= "";
    systemData.components ??= {};
  }

  _prepareWeaponData(systemData) {
    systemData.enhancement ??= 0;
    systemData.weaponSubtype ??= systemData.actionType === "rwak" ? "ranged" : "melee";
    systemData.proficient = systemData.proficient !== false && systemData.proficient !== "false";
    systemData.finesse = systemData.finesse === true || systemData.finesse === "true";
    systemData.twoHanded = systemData.twoHanded === true || systemData.twoHanded === "true";
    systemData.offHand = systemData.offHand === true || systemData.offHand === "true";
    systemData.thrown = systemData.thrown === true || systemData.thrown === "true";
    systemData.secondary = systemData.secondary === true || systemData.secondary === "true";
  }

  _prepareClassData(systemData) {
    systemData.level ??= 0;
    systemData.hitDie ??= "d8";
    systemData.bab ??= "med";
    systemData.saves ??= { fort: "low", ref: "low", will: "low" };
    systemData.appliedProgression = resolveClassCombatProgression(this.name, systemData);
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

    if (item.type === "weapon" || item.type === "attack") return this._rollAttack(actor);
    if (item.type === "spell") return this._rollSpell(actor);

    const speaker = foundry.documents.BaseChatMessage.getSpeaker({ actor: actor });
    const rollMode = game.settings.get("core", "rollMode");
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

  async _rollAttack(actor) {
    const derived = this.system.derived;
    const speaker = foundry.documents.BaseChatMessage.getSpeaker({ actor });
    if (!derived?.attackBonuses?.length) {
      return foundry.documents.BaseChatMessage.create({
        speaker,
        content: `<p>${this.name} has no derived attack. Open it from a character sheet.</p>`,
      });
    }

    const rolls = [];
    const lines = [];
    if (!derived.proficient) lines.push("Not proficient: −4 on attacks.");
    if (derived.cannotAttack) lines.push("A current condition or total defense normally prevents attacks.");
    for (const note of derived.notes || []) lines.push(note);

    for (let i = 0; i < derived.attackBonuses.length; i++) {
      const bonus = derived.attackBonuses[i];
      const roll = new foundry.dice.Roll(`1d20 + ${bonus}`);
      await roll.evaluate();
      rolls.push(roll);
      const natural = roll.terms.find((term) => term.faces === 20)?.results?.[0]?.result;
      const threat = natural >= derived.threat && natural !== 1;
      const fumble = natural === 1;
      lines.push(`Attack ${i + 1}: <strong>${roll.total}</strong>${threat ? " — threat" : ""}${fumble ? " — natural 1" : ""}`);
      if (threat) {
        const confirm = new foundry.dice.Roll(`1d20 + ${bonus}`);
        await confirm.evaluate();
        rolls.push(confirm);
        lines.push(`Confirm: <strong>${confirm.total}</strong> (critical ×${derived.multiplier} if this hits)`);
      }
    }

    if (derived.damageFormula && derived.damageFormula !== "0") {
      try {
        const damage = new foundry.dice.Roll(derived.damageFormula);
        await damage.evaluate();
        rolls.push(damage);
        const applied = applyEnergyToDamage(damage.total, derived.damageType, actor.system.attributes?.energy);
        const typeNote = derived.damageType ? ` ${derived.damageType}` : "";
        const resistNote = applied.note ? ` (${applied.note} → ${applied.amount})` : "";
        lines.push(`Damage${typeNote}: <strong>${damage.total}</strong>${resistNote}`);
      } catch (err) {
        lines.push(`Damage formula could not be rolled (${derived.damageFormula}).`);
        console.warn("CTS DND 3.5 | Damage roll failed", err);
      }
    }

    const dr = Array.isArray(actor.system.attributes?.dr) ? actor.system.attributes.dr : [];
    if (dr.length) {
      lines.push(`DR: ${dr.map((row) => `${row.amount ?? 0}/${row.bypass || "—"}`).join(", ")} (apply bypass at the table)`);
    }

    return foundry.documents.BaseChatMessage.create({
      speaker,
      rolls,
      flavor: this.name,
      content: `<div class="cts-dnd-35 chat-card"><h3>${this.name}</h3><p>${derived.attackLabel} · ${derived.damageFormula}</p>${lines.map((line) => `<p>${line}</p>`).join("")}</div>`,
    });
  }

  async _rollSpell(actor) {
    const derived = this.system.derived || {};
    const speaker = foundry.documents.BaseChatMessage.getSpeaker({ actor });
    const rolls = [];
    const lines = [];
    const level = Math.floor(Number(this.system.spellLevel) || 0);
    lines.push(`${this.system.school || "Spell"} ${level}${derived.className ? ` · ${derived.className} CL ${derived.casterLevel}` : ""}`);
    if (derived.dc != null) {
      const save = derived.saveAbility ? ` ${derived.saveAbility}` : "";
      lines.push(`Save DC <strong>${derived.dc}</strong>${save}`);
    } else {
      lines.push("Save DC needs a spellcasting class on this actor.");
    }
    if (derived.slotLevel != null && derived.slotLevel !== level) lines.push(`Slot level ${derived.slotLevel}`);
    if (derived.empower) lines.push("Empowered: multiply damage by 1.5");
    if (derived.preparation === "prepared") {
      const count = Math.max(0, Math.floor(Number(derived.prepared) || 0));
      if (count <= 0) lines.push("Not prepared.");
      else {
        await this.update({ "system.prepared": count - 1 });
        lines.push(`Prepared remaining: ${count - 1}`);
      }
    } else if (derived.preparation === "spontaneous" && derived.classKey) {
      const slot = String(derived.slotLevel ?? level);
      const stored = foundry.utils.deepClone(actor.system.spellcasting?.classes?.[derived.classKey] || {});
      stored.expended = stored.expended || {};
      stored.expended[slot] = Math.max(0, Math.floor(Number(stored.expended[slot]) || 0)) + 1;
      stored.className = stored.className || derived.className;
      await actor.update({ [`system.spellcasting.classes.${derived.classKey}`]: stored });
      lines.push(`Spontaneous slot ${slot} spent`);
    }
    if (derived.failureChance > 0) {
      const check = new foundry.dice.Roll("1d100");
      await check.evaluate();
      rolls.push(check);
      const failed = check.total <= derived.failureChance;
      lines.push(`Failure chance ${derived.failureChance}%: rolled <strong>${check.total}</strong> — ${failed ? "spell fails" : "spell succeeds"}`);
    }
    const castDefensively = actor.system.attributes?.combat?.castDefensively === true || actor.system.attributes?.combat?.castDefensively === "true";
    if (castDefensively) {
      const skill = Math.floor(Number(actor.system.skills?.con?.total) || 0);
      const dc = Math.floor(Number(derived.concentrationDc) || 15 + level);
      const conc = new foundry.dice.Roll(`1d20 + ${skill}`);
      await conc.evaluate();
      rolls.push(conc);
      lines.push(`Defensive casting: <strong>${conc.total}</strong> vs DC ${dc} — ${conc.total >= dc ? "maintained" : "spell lost"}`);
    }
    const casterLevel = Math.floor(Number(derived.casterLevel) || 0);
    const penetration = Math.floor(Number(derived.spellPenetration) || 0);
    if (casterLevel || penetration) {
      const sr = new foundry.dice.Roll(`1d20 + ${casterLevel + penetration}`);
      await sr.evaluate();
      rolls.push(sr);
      lines.push(`Spell resistance check: <strong>${sr.total}</strong> (1d20 + CL ${casterLevel}${penetration ? ` + ${penetration}` : ""})`);
    }
    return foundry.documents.BaseChatMessage.create({
      speaker,
      rolls,
      flavor: this.name,
      content: `<div class="cts-dnd-35 chat-card"><h3>${this.name}</h3>${lines.map((line) => `<p>${line}</p>`).join("")}</div>`,
    });
  }
}
