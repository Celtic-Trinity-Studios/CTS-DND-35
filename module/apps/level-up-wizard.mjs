import { CTSDND35 } from "../helpers/config.mjs";
import {
  evaluateFeatPrerequisites,
  getClassFeatureGrants,
  getKnownFeatNames,
  getSkillPointCost,
  getSkillRankCap,
  getSpellcastingProgression
} from "../helpers/progression-rules.mjs";

export class LevelUpWizard extends Application {
  constructor(actor, options = {}) {
    super(options);
    this.actor = actor;
    this.classChoices = [];
    this.classSkillMap = {};
    this.featChoices = [];
    this.spellChoices = [];
    this.state = {
      step: 1,
      selectedClassUuid: "",
      hpMethod: "fixed",
      hpManual: 1,
      skillRanks: this._initSkillRanks(),
      featSearch: "",
      selectedFeatUuid: "",
      spellSearch: "",
      selectedSpellUuids: [],
      spellPickCapsByLevel: {}
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
      classSkills: Array.isArray(doc.system?.classSkills) ? doc.system.classSkills : [],
      spellcastingType: doc.system?.spellcasting?.type || "none"
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

  async _loadSpellChoices() {
    if (this.spellChoices.length) return;
    const pack = game.packs.get("CTS-DND-35.srd-spells");
    if (!pack) return;
    const docs = await pack.getDocuments();
    this.spellChoices = docs.map((doc) => ({
      uuid: doc.uuid,
      name: doc.name,
      spellLevel: Number(doc.system?.spellLevel) || 0,
      description: doc.system?.description || ""
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
    return getSkillPointCost(this._isClassSkill(skillKey), rankDelta);
  }

  _skillRankCap(skillKey) {
    return getSkillRankCap(this._nextLevel(), this._isClassSkill(skillKey));
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
    return getKnownFeatNames(this.actor);
  }

  _evaluateFeatPrerequisites(feat) {
    return evaluateFeatPrerequisites({
      prereqText: feat.prerequisites,
      abilities: this.actor.system?.abilities,
      bab: this.actor.system?.attributes?.bab?.total,
      totalLevel: this._nextLevel(),
      knownFeatNames: this._getCurrentFeatNames(),
      allFeatNames: this.featChoices.map((f) => f.name),
      featName: feat.name
    });
  }

  _classLevelAfterGain() {
    const cls = this.classChoices.find((c) => c.uuid === this.state.selectedClassUuid);
    if (!cls) return 1;
    const existing = this.actor.items.find((i) => i.type === "class" && i.name.toLowerCase() === cls.name.toLowerCase());
    return (Number(existing?.system?.level) || 0) + 1;
  }

  _spellcastingType() {
    const cls = this._selectedClass();
    return String(cls?.spellcastingType || "").toLowerCase();
  }

  _spellcastingModeForClass(classDoc) {
    const className = String(classDoc?.name || this._selectedClass()?.name || "").toLowerCase();
    if (["sorcerer", "bard"].includes(className)) return "spontaneous";
    const type = String(classDoc?.system?.spellcasting?.type || this._spellcastingType() || "").toLowerCase();
    if (!type || type === "none") return "none";
    return "prepared";
  }

  _maxSpellLevelAfterGain(classDoc) {
    const progression = classDoc?.system?.spellcasting?.progression || {};
    const row = progression?.[this._classLevelAfterGain()] || progression?.[String(this._classLevelAfterGain())] || {};
    const perDay = row?.spellsPerDay || {};
    const levels = Object.entries(perDay)
      .filter(([, n]) => Number(n) > 0)
      .map(([lvl]) => Number(lvl))
      .filter((n) => Number.isFinite(n));
    return levels.length ? Math.max(...levels) : -1;
  }

  _spellPickCapForLevel(classDoc, oldLevel, newLevel) {
    const progression = classDoc?.system?.spellcasting?.progression || {};
    const oldRow = progression?.[oldLevel] || progression?.[String(oldLevel)] || {};
    const newRow = progression?.[newLevel] || progression?.[String(newLevel)] || {};
    const oldPerDay = oldRow?.spellsPerDay || {};
    const newPerDay = newRow?.spellsPerDay || {};
    const allLvls = new Set([...Object.keys(oldPerDay), ...Object.keys(newPerDay)]);
    let cap = 0;
    for (const lvl of allLvls) {
      const gain = (Number(newPerDay[lvl]) || 0) - (Number(oldPerDay[lvl]) || 0);
      if (gain > 0) cap += gain;
    }
    return cap;
  }

  _spellPickCapsByLevelForGain(classDoc, oldLevel, newLevel) {
    const progression = classDoc?.system?.spellcasting?.progression || {};
    const oldRow = progression?.[oldLevel] || progression?.[String(oldLevel)] || {};
    const newRow = progression?.[newLevel] || progression?.[String(newLevel)] || {};
    const oldPerDay = oldRow?.spellsPerDay || {};
    const newPerDay = newRow?.spellsPerDay || {};
    const allLvls = new Set([...Object.keys(oldPerDay), ...Object.keys(newPerDay)]);
    const caps = {};
    for (const lvl of allLvls) {
      const gain = (Number(newPerDay[lvl]) || 0) - (Number(oldPerDay[lvl]) || 0);
      if (gain > 0) caps[String(lvl)] = gain;
    }
    return caps;
  }

  _selectedSpellCountsByLevel() {
    const counts = {};
    for (const uuid of this.state.selectedSpellUuids) {
      const spell = this.spellChoices.find((s) => s.uuid === uuid);
      if (!spell) continue;
      const key = String(Number(spell.spellLevel) || 0);
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }

  _spellMatchesClass(spell, className) {
    const desc = String(spell?.description || "");
    if (!desc || !className) return false;
    const classLower = className.toLowerCase();
    const levelLineMatch = desc.match(/<b>\s*Level:\s*<\/b>\s*([^<]+)/i) || desc.match(/Level:\s*([^<\n]+)/i);
    const levelLine = String(levelLineMatch?.[1] || "").toLowerCase();
    if (!levelLine) return false;
    if (classLower === "wizard" || classLower === "sorcerer") {
      return levelLine.includes("sorcerer/wizard");
    }
    return levelLine.includes(classLower);
  }

  _selectedClass() {
    return this.classChoices.find((c) => c.uuid === this.state.selectedClassUuid) || null;
  }

  async _classDocument() {
    const cls = this._selectedClass();
    if (!cls?.uuid) return null;
    return fromUuid(cls.uuid);
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

  _requiresFeatSelection(pendingFeatures = []) {
    if (this._isFeatLevel()) return true;
    return pendingFeatures.some((f) => String(f.name || "").toLowerCase().includes("bonus feat"));
  }

  async getData() {
    await this._loadClassChoices();
    await this._loadFeatChoices();
    await this._loadSpellChoices();

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
    const classDoc = await this._classDocument();
    const spellcastingMode = this._spellcastingModeForClass(classDoc);
    context.spellcastingMode = spellcastingMode;
    context.isPreparedCaster = spellcastingMode === "prepared";
    context.isSpontaneousCaster = spellcastingMode === "spontaneous";
    context.pendingFeatures = getClassFeatureGrants(classDoc?.system, this._classLevelAfterGain() - 1, this._classLevelAfterGain());
    context.requiresFeatChoice = this._requiresFeatSelection(context.pendingFeatures);
    context.spellcastingPreview = getSpellcastingProgression(
      classDoc?.system,
      classDoc?.name || this._selectedClass()?.name || "",
      this._classLevelAfterGain(),
      this.actor.system?.spellcasting
    );
    const maxSpellLevel = this._maxSpellLevelAfterGain(classDoc);
    const spellSearch = this.state.spellSearch.toLowerCase().trim();
    const className = classDoc?.name || "";
    context.maxSpellLevel = maxSpellLevel;
    const oldClassLevel = Math.max(0, this._classLevelAfterGain() - 1);
    const newClassLevel = this._classLevelAfterGain();
    context.spellPickCap = spellcastingMode === "spontaneous" ? this._spellPickCapForLevel(classDoc, oldClassLevel, newClassLevel) : 0;
    context.spellPickCapsByLevel = spellcastingMode === "spontaneous" ? this._spellPickCapsByLevelForGain(classDoc, oldClassLevel, newClassLevel) : {};
    this.state.spellPickCapsByLevel = context.spellPickCapsByLevel;
    context.spellPickCount = this.state.selectedSpellUuids.length;
    context.spellPickCountByLevel = this._selectedSpellCountsByLevel();
    context.availableSpells = this.spellChoices
      .filter((s) => maxSpellLevel >= 0 && s.spellLevel <= maxSpellLevel)
      .filter((s) => this._spellMatchesClass(s, className))
      .filter((s) => !spellSearch || s.name.toLowerCase().includes(spellSearch))
      .map((s) => ({ ...s, selected: this.state.selectedSpellUuids.includes(s.uuid) }))
      .slice(0, 200);
    context.selectedSpells = this.state.selectedSpellUuids
      .map((uuid) => this.spellChoices.find((s) => s.uuid === uuid))
      .filter(Boolean);
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
      else if (prop === "spellSearch") this.state.spellSearch = el.value;
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

    html.find(".spell-choice").click(async (ev) => {
      ev.preventDefault();
      const uuid = ev.currentTarget.dataset.uuid;
      if (!uuid) return;
      if (this.state.selectedSpellUuids.includes(uuid)) return;
      const cls = this.classChoices.find((c) => c.uuid === this.state.selectedClassUuid);
      const existingClass = this.actor.items.find((i) => i.type === "class" && i.name.toLowerCase() === (cls?.name || "").toLowerCase());
      const oldClassLevel = Number(existingClass?.system?.level) || 0;
      const newClassLevel = oldClassLevel + 1;
      const classDoc = await fromUuid(this.state.selectedClassUuid);
      const mode = this._spellcastingModeForClass(classDoc);
      const cap = mode === "spontaneous" ? this._spellPickCapForLevel(classDoc, oldClassLevel, newClassLevel) : 0;
      const capsByLevel = mode === "spontaneous" ? this._spellPickCapsByLevelForGain(classDoc, oldClassLevel, newClassLevel) : {};
      const spell = this.spellChoices.find((s) => s.uuid === uuid);
      const lvlKey = String(Number(spell?.spellLevel) || 0);
      const currentByLevel = this._selectedSpellCountsByLevel();
      if (mode === "spontaneous") {
        if ((Number(capsByLevel[lvlKey]) || 0) <= 0) return;
        if ((currentByLevel[lvlKey] || 0) >= (Number(capsByLevel[lvlKey]) || 0)) return;
      }
      if (cap > 0 && this.state.selectedSpellUuids.length >= cap) return;
      this.state.selectedSpellUuids.push(uuid);
      this.render();
    });

    html.find(".remove-spell").click((ev) => {
      ev.preventDefault();
      const uuid = ev.currentTarget.dataset.uuid;
      this.state.selectedSpellUuids = this.state.selectedSpellUuids.filter((u) => u !== uuid);
      this.render();
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
    const classDoc = await fromUuid(this.state.selectedClassUuid);
    const pendingFeaturePreview = getClassFeatureGrants(classDoc?.system, this._classLevelAfterGain() - 1, this._classLevelAfterGain());
    if (this._requiresFeatSelection(pendingFeaturePreview) && !this.state.selectedFeatUuid) {
      ui.notifications.warn("This level grants a feat choice. Please choose one.");
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
    const previewOldClassLevel = Math.max(0, this._classLevelAfterGain() - 1);
    const newClassLevelPreview = this._classLevelAfterGain();
    const mode = this._spellcastingModeForClass(classDoc);
    const spellPickCap = mode === "spontaneous" ? this._spellPickCapForLevel(classDoc, previewOldClassLevel, newClassLevelPreview) : 0;
    const spellPickCapsByLevel = mode === "spontaneous" ? this._spellPickCapsByLevelForGain(classDoc, previewOldClassLevel, newClassLevelPreview) : {};
    const selectedByLevel = this._selectedSpellCountsByLevel();
    if (spellPickCap > 0 && this.state.selectedSpellUuids.length > spellPickCap) {
      ui.notifications.warn(`You may pick at most ${spellPickCap} new spells for this level.`);
      return;
    }
    for (const [lvl, count] of Object.entries(selectedByLevel)) {
      const capForLevel = Number(spellPickCapsByLevel[lvl]) || 0;
      if (count > capForLevel) {
        ui.notifications.warn(`Too many level ${lvl} spells selected (${count}/${capForLevel}).`);
        return;
      }
    }

    const cls = this.classChoices.find((c) => c.uuid === this.state.selectedClassUuid);
    if (!cls) return;
    if (!classDoc) return;

    const existingClass = this.actor.items.find((i) => i.type === "class" && i.name.toLowerCase() === cls.name.toLowerCase());
    const oldClassLevel = Number(existingClass?.system?.level) || 0;
    const newClassLevel = oldClassLevel + 1;
    if (existingClass) {
      await existingClass.update({ "system.level": newClassLevel });
    } else {
      const data = classDoc.toObject();
      data.system = data.system || {};
      data.system.level = 1;
      await this.actor.createEmbeddedDocuments("Item", [data]);
    }

    const hpGain = this._hpGainForDisplay();
    const hpValue = Number(this.actor.system?.attributes?.hp?.value) || 0;
    const hpMax = Number(this.actor.system?.attributes?.hp?.max) || 0;
    const updates = {
      "system.attributes.hp.max": hpMax + hpGain,
      "system.attributes.hp.value": hpValue + hpGain,
      "system.spellcasting.classes": foundry.utils.deepClone(this.actor.system?.spellcasting?.classes || {})
    };
    for (const [key, add] of Object.entries(this.state.skillRanks)) {
      updates[`system.skills.${key}.ranks`] = (Number(this.actor.system?.skills?.[key]?.ranks) || 0) + (Number(add) || 0);
    }
    const spellcastingGain = getSpellcastingProgression(classDoc.system, classDoc.name, newClassLevel, this.actor.system?.spellcasting);
    if (spellcastingGain) {
      updates["system.spellcasting.classes"][spellcastingGain.key] = spellcastingGain.data;
    }
    await this.actor.update(updates);

    const pendingFeatures = getClassFeatureGrants(classDoc.system, oldClassLevel, newClassLevel);
    if (pendingFeatures.length) {
      const existingFeatureNames = new Set(this.actor.items.filter((i) => i.type === "feature").map((i) => i.name.toLowerCase()));
      const newFeatures = pendingFeatures
        .filter((f) => !existingFeatureNames.has(f.name.toLowerCase()))
        .map((f) => ({
          name: f.name,
          type: "feature",
          img: "icons/svg/book.svg",
          system: {
            description: `<p>Granted by ${classDoc.name} at class level ${f.level}.</p>`,
            source: classDoc.name,
            featureType: "class",
            classSource: classDoc.name
          }
        }));
      if (newFeatures.length) await this.actor.createEmbeddedDocuments("Item", newFeatures);
    }

    if (this.state.selectedFeatUuid) {
      const featDoc = await fromUuid(this.state.selectedFeatUuid);
      if (featDoc) {
        const exists = this.actor.items.some((i) => i.type === "feat" && i.name.toLowerCase() === featDoc.name.toLowerCase());
        if (!exists) await this.actor.createEmbeddedDocuments("Item", [featDoc.toObject()]);
      }
    }
    for (const uuid of this.state.selectedSpellUuids) {
      const spellDoc = await fromUuid(uuid);
      if (!spellDoc) continue;
      const exists = this.actor.items.some((i) => i.type === "spell" && i.name.toLowerCase() === spellDoc.name.toLowerCase());
      if (!exists) await this.actor.createEmbeddedDocuments("Item", [spellDoc.toObject()]);
    }

    this.actor.sheet?.render(true);
    ui.notifications.info(`${this.actor.name} advanced to level ${this._nextLevel()}.`);
    this.close();
  }
}
