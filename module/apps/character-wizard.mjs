import { CTSDND35 } from "../helpers/config.mjs";
import {
  evaluateFeatPrerequisites,
  getClassFeatureGrants,
  getKnownFeatNames,
  getSkillPointCost,
  getSkillRankCap,
  getSpellcastingProgression
} from "../helpers/progression-rules.mjs";

export class CharacterWizard extends Application {
  constructor(actor, options = {}) {
    super(options);
    this.actor = actor;
    this.featChoices = [];
    this.spellChoices = [];
    this.classChoices = [];
    this.classSkillMap = {};
    this._hydratedFromActor = false;
    this.state = {
      step: 1,
      basics: {
        name: actor.name || "New Character",
        race: "human",
        alignment: "tn",
        deity: "",
        size: "med"
      },
      abilityMethod: "array",
      abilities: {
        str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8
      },
      rolls: [],
      classes: {
        primary: "",
        secondary: ""
      },
      classLevels: {
        primary: 1,
        secondary: 0
      },
      skillRanks: {
        primary: this._initSkillRanks(),
        secondary: this._initSkillRanks()
      },
      featSearch: "",
      featTypeFilter: "all",
      selectedFeatUuids: [],
      activeFeatUuid: "",
      featSlots: 1,
      spellSearch: "",
      selectedSpellUuids: [],
      spellPickCap: 0
    };
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "character-wizard",
      classes: ["cts-dnd-35", "wizard"],
      template: "systems/CTS-DND-35/templates/apps/character-wizard.hbs",
      width: 500,
      height: 600,
      title: "Create Character Wizard",
      resizable: false
    });
  }

  async getData() {
    await this._hydrateFromActor();
    await this._loadSpellChoices();
    const context = super.getData() ?? {};
    const allowGestalt = game.settings.get("CTS-DND-35", "enableGestalt");
    context.actor = this.actor;
    context.state = this.state;
    context.config = CTSDND35;
    context.allowGestalt = allowGestalt;
    
    context.isStep1 = this.state.step === 1;
    context.isStep2 = this.state.step === 2;
    context.isStep3 = this.state.step === 3;
    context.isStep4 = this.state.step === 4;
    
    // Calculate point buy (3.5e standard rules: 8 is 0, up to 18 is 16)
    const pbCost = { 8:0, 9:1, 10:2, 11:3, 12:4, 13:5, 14:6, 15:8, 16:10, 17:13, 18:16 };
    let spent = 0;
    for(let a in this.state.abilities) {
      const val = this.state.abilities[a];
      spent += pbCost[val] || 0;
    }
    context.pointBuyRemaining = 25 - spent;

    // Racial mods
    const currentRace = CTSDND35.races[this.state.basics.race] || { abilities: {} };
    context.currentRace = currentRace;

    // Final abilities
    context.finalAbilities = {};
    for (let a of ["str", "dex", "con", "int", "wis", "cha"]) {
      context.finalAbilities[a] = (this.state.abilities[a] || 10) + (currentRace.abilities[a] || 0);
    }

    const intMod = Math.floor(((context.finalAbilities.int || 10) - 10) / 2);
    await this._loadClassChoices();
    const primaryBudget = this._computeClassSkillBudget(this.state.classes.primary, intMod);
    const secondaryBudget = allowGestalt ? this._computeClassSkillBudget(this.state.classes.secondary, intMod) : 0;
    const primarySpent = this._skillCostSpent("primary");
    const secondarySpent = this._skillCostSpent("secondary");
    context.skillBudget = {
      primary: primaryBudget,
      secondary: secondaryBudget,
      primarySpent,
      secondarySpent: allowGestalt ? secondarySpent : 0,
      primaryRemaining: primaryBudget - primarySpent,
      secondaryRemaining: allowGestalt ? (secondaryBudget - secondarySpent) : 0
    };

    context.classChoices = this.classChoices;
    context.primaryClassLabel = this._classLabel(this.state.classes.primary);
    context.secondaryClassLabel = allowGestalt ? this._classLabel(this.state.classes.secondary) : "Secondary";
    context.skillRows = Object.entries(CTSDND35.skills).map(([key, skill]) => {
      const pRanks = this.state.skillRanks.primary[key] || 0;
      const sRanks = allowGestalt ? (this.state.skillRanks.secondary[key] || 0) : 0;
      const totalRanks = pRanks + sRanks;
      const abilityMod = Math.floor(((context.finalAbilities[skill.ability] || 10) - 10) / 2);
      const classBonus = totalRanks >= 1 && this._isClassSkillForSelected(key) ? 3 : 0;
      const primaryIsClass = (this.classSkillMap[this.state.classes.primary] || []).includes(key);
      const secondaryIsClass = (this.classSkillMap[this.state.classes.secondary] || []).includes(key);
      return {
        key,
        label: skill.label,
        ability: skill.ability.toUpperCase(),
        primaryRanks: pRanks,
        secondaryRanks: sRanks,
        primaryCost: getSkillPointCost(primaryIsClass, 1),
        secondaryCost: getSkillPointCost(secondaryIsClass, 1),
        rankCap: getSkillRankCap(1, primaryIsClass || (allowGestalt && secondaryIsClass)),
        total: totalRanks + abilityMod + classBonus
      };
    });
    const primaryClassDoc = this.state.classes.primary ? await fromUuid(this.state.classes.primary) : null;
    const secondaryClassDoc = allowGestalt && this.state.classes.secondary ? await fromUuid(this.state.classes.secondary) : null;
    context.primaryFeaturePreview = getClassFeatureGrants(primaryClassDoc?.system, 0, this.state.classLevels.primary || 0);
    context.secondaryFeaturePreview = allowGestalt
      ? getClassFeatureGrants(secondaryClassDoc?.system, 0, this.state.classLevels.secondary || 0)
      : [];

    await this._loadFeatChoices();
    const featSearch = this.state.featSearch.trim().toLowerCase();
    context.featChoices = this.featChoices.filter((feat) => {
      const searchOk = !featSearch || feat.name.toLowerCase().includes(featSearch);
      const typeOk = this.state.featTypeFilter === "all" || feat.type === this.state.featTypeFilter;
      return searchOk && typeOk;
    });
    const knownFeatNames = getKnownFeatNames(this.actor);
    context.featChoices = context.featChoices.map((feat) => {
      const check = evaluateFeatPrerequisites({
        prereqText: feat.prerequisites,
        abilities: Object.fromEntries(Object.entries(context.finalAbilities).map(([k, v]) => [k, { value: v }])),
        bab: this.actor.system?.attributes?.bab?.total || 0,
        totalLevel: 1,
        knownFeatNames,
        allFeatNames: this.featChoices.map((f) => f.name),
        featName: feat.name
      });
      return { ...feat, prereqOk: check.ok, prereqReason: check.reasons.join("; ") };
    });
    context.featTypes = Array.from(new Set(this.featChoices.map((f) => f.type).filter(Boolean))).sort();
    context.selectedFeats = this.state.selectedFeatUuids
      .map((uuid) => this.featChoices.find((f) => f.uuid === uuid))
      .filter(Boolean);
    const active = this.featChoices.find((f) => f.uuid === this.state.activeFeatUuid);
    context.activeFeat = active ?? null;
    const baseFeatSlots = this.state.basics.race === "human" ? 2 : 1;
    const bonusFeatSlots =
      this._countBonusFeatGrants(context.primaryFeaturePreview) +
      this._countBonusFeatGrants(context.secondaryFeaturePreview);
    context.featSlots = baseFeatSlots + bonusFeatSlots;
    this.state.featSlots = context.featSlots;
    context.featsRemaining = context.featSlots - this.state.selectedFeatUuids.length;
    const spellSearch = this.state.spellSearch.toLowerCase().trim();
    const castingDocs = [primaryClassDoc, secondaryClassDoc].filter(Boolean);
    const allowedSpellMap = new Map();
    for (const classDoc of castingDocs) {
      const level = classDoc?.uuid === this.state.classes.primary ? this.state.classLevels.primary : this.state.classLevels.secondary;
      const maxLvl = this._maxSpellLevelForClass(classDoc, level || 0);
      if (maxLvl < 0) continue;
      for (const spell of this.spellChoices) {
        if (spell.spellLevel > maxLvl) continue;
        if (!this._spellMatchesClass(spell, classDoc.name)) continue;
        allowedSpellMap.set(spell.uuid, spell);
      }
    }
    context.availableSpells = Array.from(allowedSpellMap.values())
      .filter((s) => !spellSearch || s.name.toLowerCase().includes(spellSearch))
      .slice(0, 200);
    context.selectedSpells = this.state.selectedSpellUuids
      .map((uuid) => allowedSpellMap.get(uuid) || this.spellChoices.find((s) => s.uuid === uuid))
      .filter(Boolean);
    context.spellPickCap = castingDocs.reduce((sum, classDoc) => {
      const level = classDoc?.uuid === this.state.classes.primary ? this.state.classLevels.primary : this.state.classLevels.secondary;
      return sum + this._spellPickCapForClass(classDoc, level || 0);
    }, 0);
    this.state.spellPickCap = context.spellPickCap;
    context.spellPickCount = this.state.selectedSpellUuids.length;
    
    return context;
  }

  _initSkillRanks() {
    const skills = {};
    for (const key of Object.keys(CTSDND35.skills)) {
      skills[key] = 0;
    }
    return skills;
  }

  async _loadFeatChoices() {
    if (this.featChoices.length) return;
    const pack = game.packs.get("CTS-DND-35.srd-feats");
    if (!pack) return;

    const docs = await pack.getDocuments();
    this.featChoices = docs
      .map((doc) => ({
        uuid: doc.uuid,
        name: doc.name,
        type: doc.system?.featType || "General",
        description: doc.system?.description || "",
        prerequisites: doc.system?.prerequisites || ""
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async _loadClassChoices() {
    if (this.classChoices.length) return;
    const pack = game.packs.get("CTS-DND-35.srd-classes");
    if (!pack) return;

    const docs = await pack.getDocuments();
    this.classChoices = docs
      .map((doc) => ({
        uuid: doc.uuid,
        name: doc.name,
        skillRanksPerLevel: Number(doc.system?.skillRanksPerLevel) || 2,
        classSkills: Array.isArray(doc.system?.classSkills) ? doc.system.classSkills : [],
        spellcastingType: doc.system?.spellcasting?.type || "none"
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    this.classSkillMap = Object.fromEntries(this.classChoices.map((c) => [c.uuid, c.classSkills]));
  }

  async _loadSpellChoices() {
    if (this.spellChoices.length) return;
    const pack = game.packs.get("CTS-DND-35.srd-spells");
    if (!pack) return;
    const docs = await pack.getDocuments();
    this.spellChoices = docs
      .map((doc) => ({
        uuid: doc.uuid,
        name: doc.name,
        spellLevel: Number(doc.system?.spellLevel) || 0,
        description: doc.system?.description || ""
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  _spellMatchesClass(spell, className) {
    const desc = String(spell?.description || "");
    if (!desc || !className) return false;
    const classLower = className.toLowerCase();
    const levelLineMatch = desc.match(/<b>\s*Level:\s*<\/b>\s*([^<]+)/i) || desc.match(/Level:\s*([^<\n]+)/i);
    const levelLine = String(levelLineMatch?.[1] || "").toLowerCase();
    if (!levelLine) return false;
    if (classLower === "wizard" || classLower === "sorcerer") return levelLine.includes("sorcerer/wizard");
    return levelLine.includes(classLower);
  }

  _maxSpellLevelForClass(classDoc, classLevel) {
    const progression = classDoc?.system?.spellcasting?.progression || {};
    const row = progression?.[classLevel] || progression?.[String(classLevel)] || {};
    const perDay = row?.spellsPerDay || {};
    const levels = Object.entries(perDay)
      .filter(([, n]) => Number(n) > 0)
      .map(([lvl]) => Number(lvl))
      .filter((n) => Number.isFinite(n));
    return levels.length ? Math.max(...levels) : -1;
  }

  _spellPickCapForClass(classDoc, classLevel) {
    const progression = classDoc?.system?.spellcasting?.progression || {};
    const row = progression?.[classLevel] || progression?.[String(classLevel)] || {};
    const perDay = row?.spellsPerDay || {};
    return Object.values(perDay).reduce((sum, n) => sum + Math.max(0, Number(n) || 0), 0);
  }

  _getRaceKeyFromActor() {
    const actorRace = (this.actor.system?.details?.race || "").toLowerCase().trim();
    if (!actorRace) return this.state.basics.race;
    for (const [key, def] of Object.entries(CTSDND35.races)) {
      if (def.label.toLowerCase() === actorRace) return key;
    }
    return this.state.basics.race;
  }

  async _hydrateFromActor() {
    if (this._hydratedFromActor) return;

    await this._loadClassChoices();
    await this._loadFeatChoices();

    const actorSystem = this.actor.system || {};
    const raceKey = this._getRaceKeyFromActor();
    this.state.basics = {
      name: this.actor.name || "New Character",
      race: raceKey,
      alignment: actorSystem.details?.alignment || "tn",
      deity: actorSystem.details?.deity || "",
      size: actorSystem.traits?.size || CTSDND35.races[raceKey]?.size || "med"
    };

    for (const key of ["str", "dex", "con", "int", "wis", "cha"]) {
      this.state.abilities[key] = Number(actorSystem.abilities?.[key]?.value) || this.state.abilities[key];
    }

    const classItems = this.actor.items
      .filter((i) => i.type === "class")
      .map((i) => ({ name: i.name, level: Number(i.system?.level) || 1 }))
      .sort((a, b) => b.level - a.level);

    const matchClassUuid = (name) => {
      const hit = this.classChoices.find((c) => c.name.toLowerCase() === (name || "").toLowerCase());
      return hit?.uuid || "";
    };

    if (classItems[0]) {
      this.state.classes.primary = matchClassUuid(classItems[0].name);
      this.state.classLevels.primary = classItems[0].level;
    }
    if (classItems[1]) {
      this.state.classes.secondary = matchClassUuid(classItems[1].name);
      this.state.classLevels.secondary = classItems[1].level;
    }

    for (const key of Object.keys(CTSDND35.skills)) {
      this.state.skillRanks.primary[key] = Number(actorSystem.skills?.[key]?.ranks) || 0;
      this.state.skillRanks.secondary[key] = 0;
    }

    const actorFeats = this.actor.items.filter((i) => i.type === "feat");
    const selected = [];
    for (const feat of actorFeats) {
      const sourceUuid = feat.flags?.core?.sourceId;
      const bySource = this.featChoices.find((f) => f.uuid === sourceUuid);
      if (bySource) {
        selected.push(bySource.uuid);
        continue;
      }
      const byName = this.featChoices.find((f) => f.name.toLowerCase() === feat.name.toLowerCase());
      if (byName) selected.push(byName.uuid);
    }
    this.state.selectedFeatUuids = [...new Set(selected)];
    this.state.activeFeatUuid = this.state.selectedFeatUuids[0] || "";

    this._hydratedFromActor = true;
  }

  _computeClassSkillBudget(classUuid, intMod) {
    if (!classUuid) return 0;
    const cls = this.classChoices.find((c) => c.uuid === classUuid);
    if (!cls) return 0;
    const humanBonus = this.state.basics.race === "human" ? 1 : 0;
    return Math.max(1, cls.skillRanksPerLevel + intMod + humanBonus) * 4;
  }

  _sumSkillRanks(rankSet) {
    return Object.values(rankSet).reduce((sum, n) => sum + (Number(n) || 0), 0);
  }

  _skillCostSpent(which) {
    let spent = 0;
    const classUuid = which === "primary" ? this.state.classes.primary : this.state.classes.secondary;
    const classSkills = this.classSkillMap[classUuid] || [];
    for (const [key, ranks] of Object.entries(this.state.skillRanks[which])) {
      spent += getSkillPointCost(classSkills.includes(key), Number(ranks) || 0);
    }
    return spent;
  }

  _remainingSkillPoints(which) {
    const intBonus = CTSDND35.races[this.state.basics.race]?.abilities?.int || 0;
    const intMod = Math.floor((((this.state.abilities.int || 10) + intBonus) - 10) / 2);
    const cls = which === "primary" ? this.state.classes.primary : this.state.classes.secondary;
    const budget = this._computeClassSkillBudget(cls, intMod);
    return budget - this._skillCostSpent(which);
  }

  _classLabel(classUuid) {
    if (!classUuid) return "Class";
    const cls = this.classChoices.find((c) => c.uuid === classUuid);
    return cls?.name || "Class";
  }

  _isClassSkillForSelected(skillKey) {
    const allowGestalt = game.settings.get("CTS-DND-35", "enableGestalt");
    const primary = this.classSkillMap[this.state.classes.primary] || [];
    const secondary = allowGestalt ? (this.classSkillMap[this.state.classes.secondary] || []) : [];
    return primary.includes(skillKey) || secondary.includes(skillKey);
  }

  _countBonusFeatGrants(featureGrants = []) {
    return featureGrants.filter((f) => String(f.name || "").toLowerCase().includes("bonus feat")).length;
  }

  activateListeners(html) {
    super.activateListeners(html);
    
    // Navigation via clickable tabs
    html.find(".step-indicator").click((ev) => {
      ev.preventDefault();
      const step = Number(ev.currentTarget.dataset.step) || 1;
      this.state.step = Math.min(4, Math.max(1, step));
      this.render();
    });
    
    // Input syncing
    html.find("input, select").change(ev => {
      const el = ev.currentTarget;
      const prop = el.dataset.prop;
      if (prop) {
        if (prop.startsWith("basics.")) {
          const key = prop.split(".")[1];
          this.state.basics[key] = el.value;
          
          // Auto apply race size
          if (key === "race" && CTSDND35.races[el.value]) {
            this.state.basics.size = CTSDND35.races[el.value].size;
          }
        } 
        else if (prop.startsWith("abilities.")) {
          const key = prop.split(".")[1];
          this.state.abilities[key] = parseInt(el.value) || 8;
        } 
        else if (prop === "abilityMethod") {
          this.state.abilityMethod = el.value;
          if (el.value === "array") this.state.abilities = {str:15, dex:14, con:13, int:12, wis:10, cha:8};
          else if (el.value === "pointbuy") this.state.abilities = {str:8, dex:8, con:8, int:8, wis:8, cha:8};
          // leave "roll" alone until they click the button
        } else if (prop === "classes.primary") {
          this.state.classes.primary = el.value;
          if (!this.state.classLevels.primary) this.state.classLevels.primary = 1;
        } else if (prop === "classes.secondary") {
          this.state.classes.secondary = el.value;
        } else if (prop === "classLevels.primary") {
          this.state.classLevels.primary = Math.max(1, parseInt(el.value) || 1);
        } else if (prop === "classLevels.secondary") {
          this.state.classLevels.secondary = Math.max(0, parseInt(el.value) || 0);
        } else if (prop === "featSearch") {
          this.state.featSearch = el.value;
        } else if (prop === "featTypeFilter") {
          this.state.featTypeFilter = el.value;
        } else if (prop === "spellSearch") {
          this.state.spellSearch = el.value;
        } else if (prop.startsWith("skills.")) {
          const [, which, key] = prop.split(".");
          this.state.skillRanks[which][key] = Math.max(0, parseInt(el.value) || 0);
        }
        this.render();
      }
    });

    // Roll stats button
    html.find(".roll-stats").click(async ev => {
      this.state.rolls = [];
      const abl = ["str", "dex", "con", "int", "wis", "cha"];
      
      for(let i=0; i<6; i++) {
        const roll = new foundry.dice.Roll("4d6kh3");
        await roll.evaluate();
        this.state.rolls.push(roll.total);
        this.state.abilities[abl[i]] = roll.total;
      }
      this.render();
    });

    // Finish
    html.find(".apply-wizard").click(async ev => {
      ev.preventDefault();
      await this._applyToActor();
    });

    html.find(".skill-inc").click((ev) => {
      ev.preventDefault();
      const which = ev.currentTarget.dataset.which;
      const skill = ev.currentTarget.dataset.skill;
      if (!which || !skill) return;
      if (which === "secondary" && !game.settings.get("CTS-DND-35", "enableGestalt")) return;
      const classUuid = which === "primary" ? this.state.classes.primary : this.state.classes.secondary;
      const classSkills = this.classSkillMap[classUuid] || [];
      const nextCost = getSkillPointCost(classSkills.includes(skill), 1);
      if (this._remainingSkillPoints(which) < nextCost) return;
      const current = this.state.skillRanks[which][skill] || 0;
      const other = which === "primary" ? (this.state.skillRanks.secondary[skill] || 0) : (this.state.skillRanks.primary[skill] || 0);
      const cap = getSkillRankCap(1, this._isClassSkillForSelected(skill));
      if (current + other >= cap) return;
      this.state.skillRanks[which][skill] = current + 1;
      this.render();
    });

    html.find(".skill-dec").click((ev) => {
      ev.preventDefault();
      const which = ev.currentTarget.dataset.which;
      const skill = ev.currentTarget.dataset.skill;
      if (!which || !skill) return;
      if (which === "secondary" && !game.settings.get("CTS-DND-35", "enableGestalt")) return;
      const current = this.state.skillRanks[which][skill] || 0;
      this.state.skillRanks[which][skill] = Math.max(0, current - 1);
      this.render();
    });

    html.find(".feat-choice").click((ev) => {
      ev.preventDefault();
      this.state.activeFeatUuid = ev.currentTarget.dataset.uuid || "";
      this.render();
    });

    html.find(".add-feat").click((ev) => {
      ev.preventDefault();
      const uuid = this.state.activeFeatUuid;
      if (!uuid) return;
      if (this.state.selectedFeatUuids.includes(uuid)) return;
      const feat = this.featChoices.find((f) => f.uuid === uuid);
      if (feat) {
        const raceDef = CTSDND35.races[this.state.basics.race] || { abilities: {} };
        const finalAbilities = foundry.utils.deepClone(this.state.abilities);
        for (const [a, mod] of Object.entries(raceDef.abilities || {})) finalAbilities[a] = (finalAbilities[a] || 10) + mod;
        const check = evaluateFeatPrerequisites({
          prereqText: feat.prerequisites,
          abilities: Object.fromEntries(Object.entries(finalAbilities).map(([k, v]) => [k, { value: v }])),
          bab: this.actor.system?.attributes?.bab?.total || 0,
          totalLevel: 1,
          knownFeatNames: getKnownFeatNames(this.actor),
          allFeatNames: this.featChoices.map((f) => f.name),
          featName: feat.name
        });
        if (!check.ok) return;
      }
      const slotLimit = Math.max(1, Number(this.state.featSlots) || 1);
      if (this.state.selectedFeatUuids.length >= slotLimit) return;
      this.state.selectedFeatUuids.push(uuid);
      this.render();
    });

    html.find(".remove-feat").click((ev) => {
      ev.preventDefault();
      const uuid = ev.currentTarget.dataset.uuid;
      this.state.selectedFeatUuids = this.state.selectedFeatUuids.filter((u) => u !== uuid);
      this.render();
    });

    html.find(".spell-choice").click((ev) => {
      ev.preventDefault();
      const uuid = ev.currentTarget.dataset.uuid;
      if (!uuid) return;
      if (this.state.selectedSpellUuids.includes(uuid)) return;
      if (this.state.spellPickCap > 0 && this.state.selectedSpellUuids.length >= this.state.spellPickCap) return;
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

  async _applyToActor() {
    const { basics, abilities } = this.state;
    const allowGestalt = game.settings.get("CTS-DND-35", "enableGestalt");
    const raceDef = CTSDND35.races[basics.race];
    if (!this.state.classes.primary) {
      ui.notifications.warn("Choose a primary class before finishing character creation.");
      return;
    }
    if (this._remainingSkillPoints("primary") < 0 || (allowGestalt && this._remainingSkillPoints("secondary") < 0)) {
      ui.notifications.warn("Skill points are overspent. Adjust allocations before finishing.");
      return;
    }
    if (this.state.spellPickCap > 0 && this.state.selectedSpellUuids.length > this.state.spellPickCap) {
      ui.notifications.warn(`You may pick at most ${this.state.spellPickCap} starting spells.`);
      return;
    }
    
    // Apply racial modifiers
    const finalAbilities = foundry.utils.deepClone(abilities);
    if (raceDef && raceDef.abilities) {
      for (let [a, mod] of Object.entries(raceDef.abilities)) {
        finalAbilities[a] += mod;
      }
    }

    const updates = {
      name: basics.name,
      "system.details.race": raceDef ? raceDef.label : basics.race,
      "system.details.alignment": basics.alignment,
      "system.details.deity": basics.deity,
      "system.traits.size": basics.size,
      "system.spellcasting.classes": foundry.utils.deepClone(this.actor.system?.spellcasting?.classes || {})
    };

    for (let a of ["str", "dex", "con", "int", "wis", "cha"]) {
      updates[`system.abilities.${a}.value`] = finalAbilities[a];
    }

    for (const key of Object.keys(CTSDND35.skills)) {
      const secondaryRanks = allowGestalt ? (this.state.skillRanks.secondary[key] || 0) : 0;
      const ranks = (this.state.skillRanks.primary[key] || 0) + secondaryRanks;
      updates[`system.skills.${key}.ranks`] = ranks;
      updates[`system.skills.${key}.misc`] = 0;
      updates[`system.skills.${key}.classSkill`] = this._isClassSkillForSelected(key);
    }

    await this.actor.update(updates);

    // Ensure selected class choices become actual class items with chosen levels.
    const chosenClasses = [
      { uuid: this.state.classes.primary, level: Math.max(1, this.state.classLevels.primary || 1) },
      { uuid: allowGestalt ? this.state.classes.secondary : "", level: allowGestalt ? Math.max(1, this.state.classLevels.secondary || 0) : 0 }
    ].filter((c) => c.uuid && c.level > 0);

    const grantedFeatures = [];
    for (const cls of chosenClasses) {
      const classDoc = await fromUuid(cls.uuid);
      if (!classDoc) continue;
      const existing = this.actor.items.find((i) => i.type === "class" && i.name.toLowerCase() === classDoc.name.toLowerCase());
      if (existing) {
        await existing.update({ "system.level": cls.level });
      } else {
        const classData = classDoc.toObject();
        classData.system = classData.system || {};
        classData.system.level = cls.level;
        await this.actor.createEmbeddedDocuments("Item", [classData]);
      }
      const spellcastingGain = getSpellcastingProgression(classDoc.system, classDoc.name, cls.level, this.actor.system?.spellcasting);
      if (spellcastingGain) {
        updates["system.spellcasting.classes"][spellcastingGain.key] = spellcastingGain.data;
      }
      grantedFeatures.push(...getClassFeatureGrants(classDoc.system, 0, cls.level).map((f) => ({ ...f, className: classDoc.name })));
    }
    await this.actor.update({ "system.spellcasting.classes": updates["system.spellcasting.classes"] });

    const featItems = [];
    const existingFeatNames = new Set(this.actor.items.filter((i) => i.type === "feat").map((i) => i.name.toLowerCase()));
    for (const uuid of this.state.selectedFeatUuids) {
      const featDoc = await fromUuid(uuid);
      if (!featDoc) continue;
      const featMeta = this.featChoices.find((f) => f.uuid === uuid);
      if (featMeta) {
        const check = evaluateFeatPrerequisites({
          prereqText: featMeta.prerequisites,
          abilities: Object.fromEntries(Object.entries(finalAbilities).map(([k, v]) => [k, { value: v }])),
          bab: this.actor.system?.attributes?.bab?.total || 0,
          totalLevel: 1,
          knownFeatNames: getKnownFeatNames(this.actor),
          allFeatNames: this.featChoices.map((f) => f.name),
          featName: featMeta.name
        });
        if (!check.ok) continue;
      }
      if (existingFeatNames.has(featDoc.name.toLowerCase())) continue;
      featItems.push(featDoc.toObject());
    }
    if (featItems.length) {
      await this.actor.createEmbeddedDocuments("Item", featItems);
    }
    if (this.state.selectedSpellUuids.length) {
      const existingSpellNames = new Set(this.actor.items.filter((i) => i.type === "spell").map((i) => i.name.toLowerCase()));
      const spellItems = [];
      for (const uuid of this.state.selectedSpellUuids) {
        const spellDoc = await fromUuid(uuid);
        if (!spellDoc) continue;
        if (existingSpellNames.has(spellDoc.name.toLowerCase())) continue;
        spellItems.push(spellDoc.toObject());
      }
      if (spellItems.length) await this.actor.createEmbeddedDocuments("Item", spellItems);
    }
    if (grantedFeatures.length) {
      const existingFeatureNames = new Set(this.actor.items.filter((i) => i.type === "feature").map((i) => i.name.toLowerCase()));
      const featureItems = grantedFeatures
        .filter((f) => !existingFeatureNames.has(f.name.toLowerCase()))
        .map((f) => ({
          name: f.name,
          type: "feature",
          img: "icons/svg/book.svg",
          system: {
            description: `<p>Granted by ${f.className} at class level ${f.level}.</p>`,
            source: f.className,
            featureType: "class",
            classSource: f.className
          }
        }));
      if (featureItems.length) await this.actor.createEmbeddedDocuments("Item", featureItems);
    }

    this.actor.sheet?.render(true);
    ui.notifications.info(`Character Wizard completed for ${basics.name}!`);
    this.close();
  }
}
