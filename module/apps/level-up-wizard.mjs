import { CTSDND35 } from "../helpers/config.mjs";

export class LevelUpWizard extends Application {
  constructor(actor, options = {}) {
    super(options);
    this.actor = actor;
    this.classChoices = [];
    this.classSkillMap = {};
    this.featChoices = [];
    this.state = {
      step: 1,
      selectedClassUuid: "",
      hpMethod: "fixed",
      hpManual: 1,
      skillRanks: this._initSkillRanks(),
      featSearch: "",
      selectedFeatUuid: ""
    };
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "level-up-wizard",
      classes: ["cts-dnd-35", "wizard"],
      template: "systems/CTS-DND-35/templates/apps/level-up-wizard.hbs",
      width: 620,
      height: 760,
      title: "Level Up Wizard",
      resizable: true
    });
  }

  _initSkillRanks() {
    const skills = {};
    for (const key of Object.keys(CTSDND35.skills)) skills[key] = 0;
    return skills;
  }

  async _loadClassChoices() {
    if (this.classChoices.length) return;
    const pack = game.packs.get("CTS-DND-35.srd-classes");
    if (!pack) return;
    const docs = await pack.getDocuments();
    this.classChoices = docs.map((doc) => ({
      uuid: doc.uuid,
      name: doc.name,
      hitDie: doc.system?.hitDie || "d8",
      skillRanksPerLevel: Number(doc.system?.skillRanksPerLevel) || 2,
      classSkills: Array.isArray(doc.system?.classSkills) ? doc.system.classSkills : []
    })).sort((a, b) => a.name.localeCompare(b.name));
    this.classSkillMap = Object.fromEntries(this.classChoices.map((c) => [c.uuid, c.classSkills]));
  }

  async _loadFeatChoices() {
    if (this.featChoices.length) return;
    const pack = game.packs.get("CTS-DND-35.srd-feats");
    if (!pack) return;
    const docs = await pack.getDocuments();
    this.featChoices = docs.map((doc) => ({
      uuid: doc.uuid,
      name: doc.name,
      type: doc.system?.featType || "General",
      prerequisites: doc.system?.prerequisites || ""
    })).sort((a, b) => a.name.localeCompare(b.name));
  }

  _totalLevel() {
    return this.actor.items.filter((i) => i.type === "class").reduce((sum, cls) => sum + (Number(cls.system?.level) || 0), 0);
  }

  _nextLevel() {
    return this._totalLevel() + 1;
  }

  _intMod() {
    return this.actor.system?.abilities?.int?.mod ?? 0;
  }

  _skillPointBudget() {
    const cls = this.classChoices.find((c) => c.uuid === this.state.selectedClassUuid);
    if (!cls) return 0;
    const humanBonus = (this.actor.system?.details?.race || "").toLowerCase() === "human" ? 1 : 0;
    return Math.max(1, cls.skillRanksPerLevel + this._intMod() + humanBonus);
  }

  _isClassSkill(skillKey) {
    const selectedClassSkills = this.classSkillMap[this.state.selectedClassUuid] || [];
    return selectedClassSkills.includes(skillKey);
  }

  _skillPointCostFor(skillKey, rankDelta) {
    return this._isClassSkill(skillKey) ? rankDelta : rankDelta * 2;
  }

  _skillRankCap(skillKey) {
    const nextLevel = this._nextLevel();
    if (this._isClassSkill(skillKey)) return nextLevel + 3;
    return Math.floor((nextLevel + 3) / 2);
  }

  _skillSpent() {
    let spent = 0;
    for (const [key, ranks] of Object.entries(this.state.skillRanks)) {
      spent += this._skillPointCostFor(key, Number(ranks) || 0);
    }
    return spent;
  }

  _isFeatLevel() {
    return this._nextLevel() % 3 === 0;
  }

  _getCurrentFeatNames() {
    return new Set(this.actor.items.filter((i) => i.type === "feat").map((i) => i.name.toLowerCase()));
  }

  _evaluateFeatPrerequisites(feat) {
    const prereqText = String(feat.prerequisites || "").trim();
    if (!prereqText) return { ok: true, reasons: [] };

    const reasons = [];
    const text = prereqText.toLowerCase();
    const abilities = this.actor.system?.abilities || {};

    const abilityMatchers = [
      ["str", /\bstr(?:ength)?\s*([0-9]{1,2})\b/i],
      ["dex", /\bdex(?:terity)?\s*([0-9]{1,2})\b/i],
      ["con", /\bcon(?:stitution)?\s*([0-9]{1,2})\b/i],
      ["int", /\bint(?:elligence)?\s*([0-9]{1,2})\b/i],
      ["wis", /\bwis(?:dom)?\s*([0-9]{1,2})\b/i],
      ["cha", /\bcha(?:risma)?\s*([0-9]{1,2})\b/i]
    ];
    for (const [key, rx] of abilityMatchers) {
      const m = prereqText.match(rx);
      if (!m) continue;
      const need = Number(m[1]) || 0;
      const have = Number(abilities[key]?.value) || 0;
      if (have < need) reasons.push(`${key.toUpperCase()} ${need}+ required`);
    }

    const babMatch = prereqText.match(/(?:base attack bonus|bab)\s*\+?\s*([0-9]+)/i);
    if (babMatch) {
      const needBab = Number(babMatch[1]) || 0;
      const haveBab = Number(this.actor.system?.attributes?.bab?.total) || 0;
      if (haveBab < needBab) reasons.push(`BAB +${needBab} required`);
    }

    const levelMatch = prereqText.match(/(?:character level|level)\s*([0-9]+)/i);
    if (levelMatch) {
      const needLvl = Number(levelMatch[1]) || 0;
      const haveLvl = this._nextLevel();
      if (haveLvl < needLvl) reasons.push(`Level ${needLvl}+ required`);
    }

    const currentFeatNames = this._getCurrentFeatNames();
    for (const known of this.featChoices) {
      const knownName = known.name.toLowerCase();
      if (!knownName || knownName === feat.name.toLowerCase()) continue;
      if (!text.includes(knownName)) continue;
      if (!currentFeatNames.has(knownName)) reasons.push(`Requires feat: ${known.name}`);
    }

    return { ok: reasons.length === 0, reasons };
  }

  _classLevelAfterGain() {
    const cls = this.classChoices.find((c) => c.uuid === this.state.selectedClassUuid);
    if (!cls) return 1;
    const existing = this.actor.items.find((i) => i.type === "class" && i.name.toLowerCase() === cls.name.toLowerCase());
    return (Number(existing?.system?.level) || 0) + 1;
  }

  _hpGainForDisplay() {
    const cls = this.classChoices.find((c) => c.uuid === this.state.selectedClassUuid);
    if (!cls) return 0;
    const hd = Number((cls.hitDie || "d8").replace("d", "")) || 8;
    if (this.state.hpMethod === "fixed") return Math.max(1, Math.floor((hd + 1) / 2));
    if (this.state.hpMethod === "max") return hd;
    if (this.state.hpMethod === "manual") return Math.max(1, Number(this.state.hpManual) || 1);
    if (this.state.hpMethod === "roll") return Math.max(1, Number(this.state.hpManual) || 1);
    return 1;
  }

  async getData() {
    await this._loadClassChoices();
    await this._loadFeatChoices();

    const context = super.getData() ?? {};
    const featSearch = this.state.featSearch.toLowerCase().trim();
    const selectedClassSkills = this.classSkillMap[this.state.selectedClassUuid] || [];
    const nextLevel = this._nextLevel();
    const budget = this._skillPointBudget();
    const spent = this._skillSpent();

    context.actor = this.actor;
    context.state = this.state;
    context.isStep1 = this.state.step === 1;
    context.isStep2 = this.state.step === 2;
    context.isStep3 = this.state.step === 3;
    context.classChoices = this.classChoices;
    context.totalLevel = this._totalLevel();
    context.nextLevel = nextLevel;
    context.classLevelAfterGain = this._classLevelAfterGain();
    context.hpGainPreview = this._hpGainForDisplay();
    context.skillPointBudget = budget;
    context.skillPointSpent = spent;
    context.skillPointRemaining = budget - spent;
    context.isFeatLevel = this._isFeatLevel();
    context.featChoices = this.featChoices
      .filter((f) => !featSearch || f.name.toLowerCase().includes(featSearch))
      .map((f) => {
        const check = this._evaluateFeatPrerequisites(f);
        return { ...f, prereqOk: check.ok, prereqReason: check.reasons.join("; ") };
      });
    context.selectedClassSkills = new Set(selectedClassSkills);
    context.skillRows = Object.entries(CTSDND35.skills).map(([key, def]) => {
      const currentRanks = Number(this.actor.system?.skills?.[key]?.ranks) || 0;
      const addRanks = Number(this.state.skillRanks[key]) || 0;
      const abilityMod = this.actor.system?.abilities?.[def.ability]?.mod || 0;
      const isClassSkill = selectedClassSkills.includes(key);
      const rankCap = this._skillRankCap(key);
      const projectedRanks = currentRanks + addRanks;
      const classBonus = projectedRanks >= 1 && isClassSkill ? 3 : 0;
      return {
        key,
        label: def.label,
        ability: def.ability.toUpperCase(),
        currentRanks,
        addRanks,
        isClassSkill,
        rankCap,
        pointCost: this._skillPointCostFor(key, 1),
        projectedTotal: projectedRanks + abilityMod + classBonus
      };
    });
    return context;
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.find(".step-indicator").click((ev) => {
      ev.preventDefault();
      const step = Number(ev.currentTarget.dataset.step) || 1;
      this.state.step = Math.min(3, Math.max(1, step));
      this.render();
    });

    html.find("input, select").change((ev) => {
      const el = ev.currentTarget;
      const prop = el.dataset.prop;
      if (!prop) return;
      if (prop === "selectedClassUuid") this.state.selectedClassUuid = el.value;
      else if (prop === "hpMethod") this.state.hpMethod = el.value;
      else if (prop === "hpManual") this.state.hpManual = Math.max(1, Number(el.value) || 1);
      else if (prop === "featSearch") this.state.featSearch = el.value;
      else if (prop === "selectedFeatUuid") this.state.selectedFeatUuid = el.value;
      this.render();
    });

    html.find(".skill-inc").click((ev) => {
      ev.preventDefault();
      const key = ev.currentTarget.dataset.skill;
      if (!key) return;
      const curr = Number(this.state.skillRanks[key]) || 0;
      const currentRanks = Number(this.actor.system?.skills?.[key]?.ranks) || 0;
      const cap = this._skillRankCap(key);
      if (currentRanks + curr >= cap) return;
      const nextCost = this._skillPointCostFor(key, 1);
      if (this._skillSpent() + nextCost > this._skillPointBudget()) return;
      this.state.skillRanks[key] = curr + 1;
      this.render();
    });

    html.find(".skill-dec").click((ev) => {
      ev.preventDefault();
      const key = ev.currentTarget.dataset.skill;
      if (!key) return;
      this.state.skillRanks[key] = Math.max(0, (this.state.skillRanks[key] || 0) - 1);
      this.render();
    });

    html.find(".roll-hp").click(async (ev) => {
      ev.preventDefault();
      const cls = this.classChoices.find((c) => c.uuid === this.state.selectedClassUuid);
      if (!cls) return;
      const hd = cls.hitDie || "d8";
      const roll = new foundry.dice.Roll(`1${hd}`);
      await roll.evaluate();
      this.state.hpMethod = "roll";
      this.state.hpManual = Math.max(1, roll.total || 1);
      this.render();
    });

    html.find(".apply-levelup").click(async (ev) => {
      ev.preventDefault();
      await this._apply();
    });
  }

  async _apply() {
    if (!this.state.selectedClassUuid) {
      ui.notifications.warn("Select a class to level up.");
      return;
    }
    if (this._skillSpent() > this._skillPointBudget()) {
      ui.notifications.warn("You have spent more skill points than available.");
      return;
    }
    if (this._isFeatLevel() && !this.state.selectedFeatUuid) {
      ui.notifications.warn("This level grants a feat. Please choose one.");
      return;
    }
    if (this.state.selectedFeatUuid) {
      const selectedFeat = this.featChoices.find((f) => f.uuid === this.state.selectedFeatUuid);
      if (selectedFeat) {
        const check = this._evaluateFeatPrerequisites(selectedFeat);
        if (!check.ok) {
          ui.notifications.warn(`Feat prerequisites not met: ${check.reasons.join(", ")}`);
          return;
        }
      }
    }

    const cls = this.classChoices.find((c) => c.uuid === this.state.selectedClassUuid);
    if (!cls) return;

    const existingClass = this.actor.items.find((i) => i.type === "class" && i.name.toLowerCase() === cls.name.toLowerCase());
    if (existingClass) {
      await existingClass.update({ "system.level": (Number(existingClass.system?.level) || 0) + 1 });
    } else {
      const classDoc = await fromUuid(cls.uuid);
      if (classDoc) {
        const data = classDoc.toObject();
        data.system = data.system || {};
        data.system.level = 1;
        await this.actor.createEmbeddedDocuments("Item", [data]);
      }
    }

    const hpGain = this._hpGainForDisplay();
    const hpValue = Number(this.actor.system?.attributes?.hp?.value) || 0;
    const hpMax = Number(this.actor.system?.attributes?.hp?.max) || 0;
    const updates = {
      "system.attributes.hp.max": hpMax + hpGain,
      "system.attributes.hp.value": hpValue + hpGain
    };
    for (const [key, add] of Object.entries(this.state.skillRanks)) {
      updates[`system.skills.${key}.ranks`] = (Number(this.actor.system?.skills?.[key]?.ranks) || 0) + (Number(add) || 0);
    }
    await this.actor.update(updates);

    if (this.state.selectedFeatUuid) {
      const featDoc = await fromUuid(this.state.selectedFeatUuid);
      if (featDoc) {
        const exists = this.actor.items.some((i) => i.type === "feat" && i.name.toLowerCase() === featDoc.name.toLowerCase());
        if (!exists) await this.actor.createEmbeddedDocuments("Item", [featDoc.toObject()]);
      }
    }

    this.actor.sheet?.render(true);
    ui.notifications.info(`${this.actor.name} advanced to level ${this._nextLevel()}.`);
    this.close();
  }
}
