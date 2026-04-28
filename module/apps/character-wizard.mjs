import { CTSDND35 } from "../helpers/config.mjs";
import {
  evaluateFeatPrerequisites,
  getClassFeatureGrants,
  getKnownFeatNames,
  getSkillPointCost,
  getSkillRankCap,
  getSpellcastingProgression,
  evaluateClassAvailability
} from "../helpers/progression-rules.mjs";
import { WizardTwoPanePicker } from "./wizard-two-pane-picker.mjs";

/** Escape for HTML attribute / text injection in picker toolbars */
const escAttr = (v) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const GENDER_DESCRIPTIONS = {
  male: "Gender is primarily aesthetic in D&D 3.5 and does not change class abilities or mechanical options.",
  female: "Gender is primarily aesthetic in D&D 3.5 and does not change class abilities or mechanical options."
};

const RACE_DESCRIPTIONS = {
  human: "Humans are adaptable and ambitious, gaining an extra feat at level 1 and additional skill flexibility.",
  dwarf: "Dwarves are sturdy and tradition-bound, known for resilience, stonecraft, and combat toughness.",
  elf: "Elves are graceful and perceptive, with natural agility and a deep connection to arcane culture.",
  gnome: "Gnomes are curious tricksters with sharp minds and a knack for illusion and invention.",
  halfElf: "Half-elves blend human drive with elven grace, often serving as versatile diplomats and wanderers.",
  halfOrc: "Half-orcs are physically powerful and intimidating, often excelling in direct martial roles.",
  halfling: "Halflings are quick and stealthy, relying on agility, luck, and careful movement."
};

const ALIGNMENT_DESCRIPTIONS = {
  lg: "Lawful Good combines compassion with discipline, valuing justice, order, and duty.",
  ng: "Neutral Good pursues kindness and mercy above all, helping others without strong ideological extremes.",
  cg: "Chaotic Good follows conscience over rigid systems, fighting oppression with personal freedom.",
  ln: "Lawful Neutral values structure, reliability, and code, regardless of moral ideology.",
  tn: "True Neutral seeks balance, pragmatism, and moderation between moral and ethical extremes.",
  cn: "Chaotic Neutral favors independence and spontaneity, resisting strict authority and expectations.",
  le: "Lawful Evil uses order and hierarchy for personal gain, often through calculated control.",
  ne: "Neutral Evil is driven by self-interest, pursuing advantage without loyalty to law or chaos.",
  ce: "Chaotic Evil embraces destruction and cruelty, rejecting restraint and structure."
};

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
        gender: "male",
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
      classSearch: "",
      activeClassUuid: "",
      showUnavailable: true,
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
      activeSpellUuid: "",
      spellPickCap: 0,
      spellPickCapsByLevel: {}
    };
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "character-wizard",
      classes: ["cts-dnd-35", "wizard"],
      template: "systems/CTS-DND-35/templates/apps/character-wizard.hbs",
      width: 1120,
      height: 780,
      title: "Create Character Wizard",
      resizable: true
    });
  }

  async getData() {
    await this._hydrateFromActor();
    await this._loadSpellChoices();
    const context = super.getData() ?? {};
    const allowGestalt = game.settings.get("CTS-DND-35", "enableGestalt");
    const showUnavailable = this.state.showUnavailable !== false;
    context.actor = this.actor;
    context.state = this.state;
    context.config = CTSDND35;
    context.allowGestalt = allowGestalt;
    
    context.isStep1 = this.state.step === 1;
    context.isStep2 = this.state.step === 2;
    context.isStep3 = this.state.step === 3;
    context.isStep4 = this.state.step === 4;
    context.isStep5 = this.state.step === 5;
    context.isStep6 = this.state.step === 6;
    context.isStep7 = this.state.step === 7;
    context.isStep8 = this.state.step === 8;
    context.genderChoices = [
      { key: "male", label: "Male", selected: this.state.basics.gender === "male" },
      { key: "female", label: "Female", selected: this.state.basics.gender === "female" }
    ];
    context.activeGenderLabel = this.state.basics.gender === "female" ? "Female Gender Selection" : "Male Gender Selection";
    context.activeGenderDescription = GENDER_DESCRIPTIONS[this.state.basics.gender] || GENDER_DESCRIPTIONS.male;
    context.raceChoices = Object.entries(CTSDND35.races).map(([key, race]) => ({
      key,
      label: race.label,
      selected: key === this.state.basics.race
    }));
    context.activeRaceLabel = CTSDND35.races[this.state.basics.race]?.label || "Race";
    context.activeRaceDescription = RACE_DESCRIPTIONS[this.state.basics.race] || "Choose a race to see its overview.";
    const raceMods = CTSDND35.races[this.state.basics.race]?.abilities || {};
    context.activeRaceAbilityMods = Object.keys(raceMods).length
      ? Object.entries(raceMods).map(([k, v]) => `${k.toUpperCase()} ${v >= 0 ? `+${v}` : v}`).join(", ")
      : "None";
    context.alignmentChoices = Object.entries(CTSDND35.alignments).map(([key, label]) => ({
      key,
      label,
      selected: key === this.state.basics.alignment
    }));
    context.activeAlignmentLabel = CTSDND35.alignments[this.state.basics.alignment] || "Alignment";
    context.activeAlignmentDescription = ALIGNMENT_DESCRIPTIONS[this.state.basics.alignment] || "Choose an alignment.";
    context.abilityStepDescription = "Ability scores define your character's core strengths. Choose a method, then adjust scores to fit your class concept.";
    
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
    context.abilityMods = {};
    for (let a of ["str", "dex", "con", "int", "wis", "cha"]) {
      context.finalAbilities[a] = (this.state.abilities[a] || 10) + (currentRace.abilities[a] || 0);
      context.abilityMods[a] = Math.floor((context.finalAbilities[a] - 10) / 2);
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

    context.classChoicesForSelect = this._filteredClassesList();
    const selectableClassChoices = this.classChoices
      .map((c) => ({ c, check: this._isClassAvailable(c) }))
      .filter(({ check }) => showUnavailable || check.ok)
      .map(({ c }) => c);
    if (this.state.classes.primary && !selectableClassChoices.some((c) => c.uuid === this.state.classes.primary && this._isClassAvailable(c).ok)) {
      this.state.classes.primary = "";
    }
    if (this.state.classes.secondary && !selectableClassChoices.some((c) => c.uuid === this.state.classes.secondary && this._isClassAvailable(c).ok)) {
      this.state.classes.secondary = "";
    }
    const activeClass = this.classChoices.find((c) => c.uuid === this.state.activeClassUuid) || null;
    context.activeClass = activeClass;
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
    const knownFeatNames = getKnownFeatNames(this.actor);
    context.featChoices = this._filteredFeatsList(context.finalAbilities, knownFeatNames, showUnavailable);
    const visibleFeatUuids = new Set(context.featChoices.filter((f) => showUnavailable || f.prereqOk).map((f) => f.uuid));
    this.state.selectedFeatUuids = this.state.selectedFeatUuids.filter((uuid) => visibleFeatUuids.has(uuid));
    if (this.state.activeFeatUuid && !visibleFeatUuids.has(this.state.activeFeatUuid)) this.state.activeFeatUuid = "";
    context.showUnavailableOptions = showUnavailable;
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
    const spontaneousDocs = castingDocs.filter((d) => this._spellcastingModeForClass(d) === "spontaneous");
    const preparedDocs = castingDocs.filter((d) => this._spellcastingModeForClass(d) === "prepared");
    context.isSpontaneousCaster = spontaneousDocs.length > 0;
    context.isPreparedCaster = preparedDocs.length > 0;
    context.spellPickCap = spontaneousDocs.reduce((sum, classDoc) => {
      const level = classDoc?.uuid === this.state.classes.primary ? this.state.classLevels.primary : this.state.classLevels.secondary;
      return sum + this._spellPickCapForClass(classDoc, level || 0);
    }, 0);
    context.spellPickCapsByLevel = spontaneousDocs.reduce((acc, classDoc) => {
      const level = classDoc?.uuid === this.state.classes.primary ? this.state.classLevels.primary : this.state.classLevels.secondary;
      const caps = this._spellPickCapsByLevelForClass(classDoc, level || 0);
      for (const [lvl, n] of Object.entries(caps)) acc[lvl] = (acc[lvl] || 0) + (Number(n) || 0);
      return acc;
    }, {});
    this.state.spellPickCapsByLevel = context.spellPickCapsByLevel;
    this.state.spellPickCap = context.spellPickCap;
    context.spellPickCount = this.state.selectedSpellUuids.length;
    context.spellPickCountByLevel = this._selectedSpellCountsByLevel();
    
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
        description: doc.system?.description || "",
        skillRanksPerLevel: Number(doc.system?.skillRanksPerLevel) || 2,
        classSkills: Array.isArray(doc.system?.classSkills) ? doc.system.classSkills : [],
        spellcastingType: doc.system?.spellcasting?.type || "none",
        requirements: doc.system?.requirements || {}
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

  _spellPickCapsByLevelForClass(classDoc, classLevel) {
    const progression = classDoc?.system?.spellcasting?.progression || {};
    const row = progression?.[classLevel] || progression?.[String(classLevel)] || {};
    const perDay = row?.spellsPerDay || {};
    const caps = {};
    for (const [lvl, n] of Object.entries(perDay)) {
      const value = Math.max(0, Number(n) || 0);
      if (value > 0) caps[String(lvl)] = value;
    }
    return caps;
  }

  _spellcastingModeForClass(classDoc) {
    const className = String(classDoc?.name || "").toLowerCase();
    if (["sorcerer", "bard"].includes(className)) return "spontaneous";
    const type = String(classDoc?.system?.spellcasting?.type || "").toLowerCase();
    if (!type || type === "none") return "none";
    return "prepared";
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
      gender: actorSystem.details?.gender || "male",
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

  _isClassAvailable(classChoice) {
    return evaluateClassAvailability({
      requirements: classChoice?.requirements || {},
      actor: this.actor,
      knownFeatNames: getKnownFeatNames(this.actor)
    });
  }

  _filteredClassesList() {
    const showUnavailable = this.state.showUnavailable !== false;
    let list = this.classChoices.map((c) => {
      const check = this._isClassAvailable(c);
      return { ...c, available: check.ok, unavailableReason: check.reasons.join("; ") };
    });
    if (!showUnavailable) list = list.filter((c) => c.available);
    const q = this.state.classSearch.toLowerCase().trim();
    return list.filter((c) => !q || c.name.toLowerCase().includes(q));
  }

  _filteredFeatsList(finalAbilities, knownFeatNames, showUnavailable) {
    const featSearch = this.state.featSearch.trim().toLowerCase();
    let list = this.featChoices.filter((feat) => {
      const searchOk = !featSearch || feat.name.toLowerCase().includes(featSearch);
      const typeOk = this.state.featTypeFilter === "all" || feat.type === this.state.featTypeFilter;
      return searchOk && typeOk;
    });
    list = list.map((feat) => {
      const check = evaluateFeatPrerequisites({
        prereqText: feat.prerequisites,
        abilities: Object.fromEntries(Object.entries(finalAbilities).map(([k, v]) => [k, { value: v }])),
        bab: this.actor.system?.attributes?.bab?.total || 0,
        totalLevel: 1,
        knownFeatNames,
        allFeatNames: this.featChoices.map((f) => f.name),
        featName: feat.name,
        actor: this.actor,
        skillCatalog: CTSDND35.skills
      });
      return { ...feat, prereqOk: check.ok, prereqReason: check.reasons.join("; ") };
    });
    if (!showUnavailable) list = list.filter((feat) => feat.prereqOk);
    return list;
  }

  _openPicker(kind, initialId) {
    const spec = this._pickerSpec(kind);
    if (!spec) return;
    const dlg = new WizardTwoPanePicker(
      foundry.utils.mergeObject(spec.options(this, initialId), {
        parentWizard: this
      })
    );
    dlg.render(true);
  }

  _pickerSpec(kind) {
    const specs = {
      gender: {
        options: (wiz, initialId) => ({
          title: "Select Gender",
          initialId: initialId || wiz.state.basics.gender,
          getContext: (sel) => wiz._pickerContextGender(sel),
          onAction: (action, sel, dlg) =>
            wiz._pickerActionSimpleApply(action, sel, dlg, (id) => {
              if (id === "male" || id === "female") wiz.state.basics.gender = id;
            })
        })
      },
      race: {
        options: (wiz, initialId) => ({
          title: "Select Race",
          initialId: initialId || wiz.state.basics.race,
          getContext: (sel) => wiz._pickerContextRace(sel),
          onAction: (action, sel, dlg) =>
            wiz._pickerActionSimpleApply(action, sel, dlg, (id) => {
              if (CTSDND35.races[id]) {
                wiz.state.basics.race = id;
                wiz.state.basics.size = CTSDND35.races[id].size;
              }
            })
        })
      },
      alignment: {
        options: (wiz, initialId) => ({
          title: "Select Alignment",
          initialId: initialId || wiz.state.basics.alignment,
          getContext: (sel) => wiz._pickerContextAlignment(sel),
          onAction: (action, sel, dlg) =>
            wiz._pickerActionSimpleApply(action, sel, dlg, (id) => {
              if (CTSDND35.alignments[id]) wiz.state.basics.alignment = id;
            })
        })
      },
      class: {
        options: (wiz, initialId) => ({
          title: "Select Class",
          initialId: initialId || wiz.state.classes.primary || wiz.classChoices[0]?.uuid,
          getContext: (sel) => wiz._pickerContextClass(sel),
          onAction: (action, sel, dlg) => wiz._pickerActionClass(action, sel, dlg)
        })
      },
      feat: {
        options: (wiz, initialId) => ({
          title: "Select Feat",
          initialId: initialId || wiz.state.activeFeatUuid || wiz._filteredFeatsList(wiz._finalAbilitiesPlain(), getKnownFeatNames(wiz.actor), wiz.state.showUnavailable !== false)[0]?.uuid,
          getContext: (sel) => wiz._pickerContextFeat(sel),
          onAction: (action, sel, dlg) => wiz._pickerActionFeat(action, sel, dlg)
        })
      },
      spell: {
        options: (wiz, initialId) => ({
          title: "Select Spell",
          initialId: initialId || wiz.state.activeSpellUuid || "",
          getContext: (sel) => wiz._pickerContextSpell(sel),
          onAction: (action, sel, dlg) => wiz._pickerActionSpell(action, sel, dlg)
        })
      },
      skill: {
        options: (wiz, initialId) => ({
          title: "Adjust Skill",
          initialId: initialId || Object.keys(CTSDND35.skills)[0],
          getContext: (sel) => wiz._pickerContextSkill(sel),
          onAction: (action, sel, dlg) => wiz._pickerActionSkill(action, sel, dlg),
          extraActivate: (html, dlg) => wiz._pickerBindSkillAdjust(html, dlg)
        })
      }
    };
    return specs[kind];
  }

  _finalAbilitiesPlain() {
    const currentRace = CTSDND35.races[this.state.basics.race] || { abilities: {} };
    const out = {};
    for (const a of ["str", "dex", "con", "int", "wis", "cha"]) {
      out[a] = (this.state.abilities[a] || 10) + (currentRace.abilities[a] || 0);
    }
    return out;
  }

  async _pickerContextGender(selectedId) {
    const id = selectedId === "female" ? "female" : "male";
    const items = ["male", "female"].map((key) => ({
      id: key,
      active: key === id,
      html: `<strong>${key === "male" ? "Male" : "Female"}</strong>`
    }));
    return {
      items,
      detailTitle: id === "female" ? "Female Gender Selection" : "Male Gender Selection",
      detailHtml: `<p>${GENDER_DESCRIPTIONS[id]}</p>`,
      actions: [
        { id: "apply", label: "OK", css: "" },
        { id: "close", label: "Cancel", css: "secondary" }
      ],
      toolbar: null
    };
  }

  async _pickerContextRace(selectedId) {
    const id = selectedId && CTSDND35.races[selectedId] ? selectedId : "human";
    const items = Object.keys(CTSDND35.races).map((key) => ({
      id: key,
      active: key === id,
      html: `<strong>${CTSDND35.races[key].label}</strong>`
    }));
    const desc = RACE_DESCRIPTIONS[id] || "";
    const r = CTSDND35.races[id];
    const mods = r?.abilities || {};
    const modStr = Object.keys(mods).length
      ? Object.entries(mods).map(([k, v]) => `${k.toUpperCase()} ${v >= 0 ? `+${v}` : v}`).join(", ")
      : "None";
    return {
      items,
      detailTitle: r?.label || "Race",
      detailHtml: `<p>${desc}</p><p><strong>Size:</strong> ${r?.size} | <strong>Speed:</strong> ${r?.speed}</p><p><strong>Ability Modifiers:</strong> ${modStr}</p>`,
      actions: [
        { id: "apply", label: "OK", css: "" },
        { id: "close", label: "Cancel", css: "secondary" }
      ],
      toolbar: null
    };
  }

  async _pickerContextAlignment(selectedId) {
    const keys = Object.keys(CTSDND35.alignments);
    const id = keys.includes(selectedId) ? selectedId : "tn";
    const items = keys.map((key) => ({
      id: key,
      active: key === id,
      html: `<strong>${CTSDND35.alignments[key]}</strong>`
    }));
    return {
      items,
      detailTitle: CTSDND35.alignments[id],
      detailHtml: `<p>${ALIGNMENT_DESCRIPTIONS[id] || ""}</p>`,
      actions: [
        { id: "apply", label: "OK", css: "" },
        { id: "close", label: "Cancel", css: "secondary" }
      ],
      toolbar: null
    };
  }

  async _pickerContextClass(selectedId) {
    const list = this._filteredClassesList();
    const toolbar = `
<div class="flexrow" style="gap:10px; flex-wrap:wrap; align-items:flex-end;">
  <div class="form-group" style="flex:1; min-width:160px;">
    <label>Search</label>
    <input type="text" data-picker-sync="classSearch" value="${escAttr(this.state.classSearch)}" />
  </div>
  <button type="button" class="cts-btn secondary wizard-toggle-unavailable" data-picker-sync="toggleUnavailable">${this.state.showUnavailable !== false ? "Hide Unavailable" : "Show Unavailable"}</button>
</div>`;
    if (!list.length) {
      return {
        items: [],
        detailTitle: "Class",
        detailHtml: "<p>No classes match your filters.</p>",
        actions: [{ id: "close", label: "Close", css: "secondary" }],
        toolbar
      };
    }
    const firstId = list[0]?.uuid || this.classChoices[0]?.uuid;
    const id = list.some((c) => c.uuid === selectedId) ? selectedId : firstId;
    const cls = this.classChoices.find((c) => c.uuid === id);
    const items = list.map((c) => ({
      id: c.uuid,
      active: c.uuid === id,
      disabled: !c.available,
      html: `<strong>${c.name}</strong>${c.available ? "" : ` <span class="notes" style="color:#c94c4c;">(unavailable)</span>`}`
    }));
    const allowGestalt = game.settings.get("CTS-DND-35", "enableGestalt");
    const actions = [
      { id: "set-primary", label: "Set as Primary", css: "", disabled: !cls || !this._isClassAvailable(cls).ok },
      { id: "close", label: "Close", css: "secondary" }
    ];
    if (allowGestalt) {
      actions.splice(1, 0, {
        id: "set-secondary",
        label: "Set as Secondary",
        css: "secondary",
        disabled: !cls || !this._isClassAvailable(cls).ok
      });
    }
    return {
      items,
      detailTitle: cls?.name || "Class",
      detailHtml: cls?.description ? String(cls.description) : "<p>No description.</p>",
      actions,
      toolbar
    };
  }

  async _pickerContextFeat(selectedId) {
    const finalAbilities = this._finalAbilitiesPlain();
    const knownFeatNames = getKnownFeatNames(this.actor);
    const showUnavailable = this.state.showUnavailable !== false;
    const list = this._filteredFeatsList(finalAbilities, knownFeatNames, showUnavailable);
    if (!list.length) {
      return {
        items: [],
        detailTitle: "Feat",
        detailHtml: "<p>No feats match your filters.</p>",
        actions: [{ id: "close", label: "Close", css: "secondary" }],
        toolbar: `<div class="flexrow" style="gap:10px; flex-wrap:wrap; align-items:flex-end;">
  <div class="form-group" style="flex:1; min-width:140px;"><label>Search</label><input type="text" data-picker-sync="featSearch" value="${escAttr(this.state.featSearch)}" /></div>
  <div class="form-group" style="flex:1; min-width:140px;"><label>Type</label><select data-picker-sync="featTypeFilter"><option value="all">Everything</option></select></div>
  <button type="button" class="cts-btn secondary wizard-toggle-unavailable" data-picker-sync="toggleUnavailable">${showUnavailable ? "Hide Unavailable" : "Show Unavailable"}</button>
</div>`
      };
    }
    const first = list[0]?.uuid || "";
    const id = list.some((f) => f.uuid === selectedId) ? selectedId : first;
    const feat = list.find((f) => f.uuid === id) || list[0];
    const featTypes = Array.from(new Set(this.featChoices.map((f) => f.type).filter(Boolean))).sort();
    const typeOptions = [`<option value="all"${this.state.featTypeFilter === "all" ? " selected" : ""}>Everything</option>`]
      .concat(featTypes.map((t) => `<option value="${escAttr(t)}"${this.state.featTypeFilter === t ? " selected" : ""}>${escAttr(t)}</option>`))
      .join("");
    const toolbar = `
<div class="flexrow" style="gap:10px; flex-wrap:wrap; align-items:flex-end;">
  <div class="form-group" style="flex:1; min-width:140px;">
    <label>Search</label>
    <input type="text" data-picker-sync="featSearch" value="${escAttr(this.state.featSearch)}" />
  </div>
  <div class="form-group" style="flex:1; min-width:140px;">
    <label>Type</label>
    <select data-picker-sync="featTypeFilter">${typeOptions}</select>
  </div>
  <button type="button" class="cts-btn secondary wizard-toggle-unavailable" data-picker-sync="toggleUnavailable">${showUnavailable ? "Hide Unavailable" : "Show Unavailable"}</button>
</div>`;
    const items = list.map((f) => ({
      id: f.uuid,
      active: f.uuid === id,
      disabled: !f.prereqOk,
      html: `<strong>${escAttr(f.name)}</strong> <span class="notes">— ${escAttr(f.type || "")}</span>`
    }));
    let detailHtml = feat?.description ? String(feat.description) : "";
    if (feat?.prereqReason) {
      detailHtml += `<hr/><p class="notes" style="color:#c94c4c;">${escAttr(feat.prereqReason)}</p>`;
    }
    const slotLimit = Math.max(1, Number(this.state.featSlots) || 1);
    const atCap = this.state.selectedFeatUuids.length >= slotLimit;
    const already = feat && this.state.selectedFeatUuids.includes(feat.uuid);
    return {
      items,
      detailTitle: feat?.name || "Feat",
      detailHtml: detailHtml || "<p>No description.</p>",
      actions: [
        {
          id: "add-feat",
          label: "Add",
          css: "",
          disabled: !feat || !feat.prereqOk || atCap || already
        },
        { id: "close", label: "Close", css: "secondary" }
      ],
      toolbar
    };
  }

  async _pickerContextSpell(selectedId) {
    const allowGestalt = game.settings.get("CTS-DND-35", "enableGestalt");
    const primaryClassDoc = this.state.classes.primary ? await fromUuid(this.state.classes.primary) : null;
    const secondaryClassDoc = allowGestalt && this.state.classes.secondary ? await fromUuid(this.state.classes.secondary) : null;
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
    const spellSearch = this.state.spellSearch.toLowerCase().trim();
    const list = Array.from(allowedSpellMap.values())
      .filter((s) => !spellSearch || s.name.toLowerCase().includes(spellSearch))
      .slice(0, 200);
    const toolbar = `
<div class="form-group">
  <label>Spell Search</label>
  <input type="text" data-picker-sync="spellSearch" value="${escAttr(this.state.spellSearch)}" placeholder="Search" />
</div>`;
    if (!list.length) {
      return {
        items: [],
        detailTitle: "Spell",
        detailHtml: "<p>No spells available for your classes, or none match your search.</p>",
        actions: [{ id: "close", label: "Close", css: "secondary" }],
        toolbar
      };
    }
    const first = list[0]?.uuid || "";
    const id = list.some((s) => s.uuid === selectedId) ? selectedId : first;
    const spell = list.find((s) => s.uuid === id);
    const items = list.map((s) => ({
      id: s.uuid,
      active: s.uuid === id,
      html: `<strong>${escAttr(s.name)}</strong> <span class="notes">(${s.spellLevel})</span>`
    }));
    const spontaneousDocs = castingDocs.filter((d) => this._spellcastingModeForClass(d) === "spontaneous");
    const caps = {};
    for (const classDoc of spontaneousDocs) {
      const level = classDoc?.uuid === this.state.classes.primary ? this.state.classLevels.primary : this.state.classLevels.secondary;
      const byLvl = this._spellPickCapsByLevelForClass(classDoc, level || 0);
      for (const [lvl, n] of Object.entries(byLvl)) caps[lvl] = (caps[lvl] || 0) + (Number(n) || 0);
    }
    const selectedByLevel = this._selectedSpellCountsByLevel();
    const lvlKey = String(Number(spell?.spellLevel) || 0);
    const levelCap = Number(caps[lvlKey]) || 0;
    const spellPickCap = spontaneousDocs.reduce((sum, classDoc) => {
      const level = classDoc?.uuid === this.state.classes.primary ? this.state.classLevels.primary : this.state.classLevels.secondary;
      return sum + this._spellPickCapForClass(classDoc, level || 0);
    }, 0);
    const canAdd =
      spell &&
      !this.state.selectedSpellUuids.includes(spell.uuid) &&
      levelCap > 0 &&
      (selectedByLevel[lvlKey] || 0) < levelCap &&
      (spellPickCap <= 0 || this.state.selectedSpellUuids.length < spellPickCap);
    return {
      items,
      detailTitle: spell?.name || "Spell",
      detailHtml: spell?.description ? String(spell.description) : "<p>No spells available for your classes.</p>",
      actions: [
        { id: "add-spell", label: "Add", css: "", disabled: !canAdd },
        { id: "close", label: "Close", css: "secondary" }
      ],
      toolbar
    };
  }

  async _pickerContextSkill(selectedId) {
    const key = CTSDND35.skills[selectedId] ? selectedId : Object.keys(CTSDND35.skills)[0];
    const skill = CTSDND35.skills[key];
    const allowGestalt = game.settings.get("CTS-DND-35", "enableGestalt");
    const p = this.state.skillRanks.primary[key] || 0;
    const s = allowGestalt ? (this.state.skillRanks.secondary[key] || 0) : 0;
    const primaryIsClass = (this.classSkillMap[this.state.classes.primary] || []).includes(key);
    const secondaryIsClass = (this.classSkillMap[this.state.classes.secondary] || []).includes(key);
    const cap = getSkillRankCap(1, this._isClassSkillForSelected(key));
    const items = Object.entries(CTSDND35.skills).map(([k, def]) => ({
      id: k,
      active: k === key,
      html: `<strong>${escAttr(def.label)}</strong>`
    }));
    const detailHtml = `
<p><strong>${escAttr(skill.label)}</strong> (${skill.ability.toUpperCase()})</p>
<p class="notes">Rank cap at 1st level: ${cap}. Class skill: ${this._isClassSkillForSelected(key) ? "yes" : "no"}</p>
<div class="flexrow" style="gap:12px; align-items:center; margin-top:8px;">
  <span>${this._classLabel(this.state.classes.primary)}:</span>
  <button type="button" class="skill-dec-pick" data-which="primary" data-skill="${key}">-</button>
  <span>${p}</span>
  <button type="button" class="skill-inc-pick" data-which="primary" data-skill="${key}">+</button>
</div>
${
  allowGestalt
    ? `<div class="flexrow" style="gap:12px; align-items:center; margin-top:8px;">
  <span>${this._classLabel(this.state.classes.secondary)}:</span>
  <button type="button" class="skill-dec-pick" data-which="secondary" data-skill="${key}">-</button>
  <span>${s}</span>
  <button type="button" class="skill-inc-pick" data-which="secondary" data-skill="${key}">+</button>
</div>`
    : ""
}
<p class="notes" style="margin-top:8px;">Primary next rank cost: ${getSkillPointCost(primaryIsClass, 1)} | Secondary: ${getSkillPointCost(secondaryIsClass, 1)}</p>`;
    return {
      items,
      detailTitle: skill.label,
      detailHtml,
      actions: [{ id: "close", label: "Close", css: "secondary" }],
      toolbar: null
    };
  }

  _pickerBindSkillAdjust(html, dlg) {
    const wiz = this;
    const rerender = async () => {
      await wiz.render();
      await dlg.render();
    };
    html.find(".skill-inc-pick").click(async (ev) => {
      ev.preventDefault();
      const which = ev.currentTarget.dataset.which;
      const skill = ev.currentTarget.dataset.skill;
      if (!which || !skill) return;
      if (which === "secondary" && !game.settings.get("CTS-DND-35", "enableGestalt")) return;
      const classUuid = which === "primary" ? wiz.state.classes.primary : wiz.state.classes.secondary;
      const classSkills = wiz.classSkillMap[classUuid] || [];
      const nextCost = getSkillPointCost(classSkills.includes(skill), 1);
      if (wiz._remainingSkillPoints(which) < nextCost) return;
      const current = wiz.state.skillRanks[which][skill] || 0;
      const other = which === "primary" ? (wiz.state.skillRanks.secondary[skill] || 0) : (wiz.state.skillRanks.primary[skill] || 0);
      const cap = getSkillRankCap(1, wiz._isClassSkillForSelected(skill));
      if (current + other >= cap) return;
      wiz.state.skillRanks[which][skill] = current + 1;
      await rerender();
    });
    html.find(".skill-dec-pick").click(async (ev) => {
      ev.preventDefault();
      const which = ev.currentTarget.dataset.which;
      const skill = ev.currentTarget.dataset.skill;
      if (!which || !skill) return;
      if (which === "secondary" && !game.settings.get("CTS-DND-35", "enableGestalt")) return;
      const current = wiz.state.skillRanks[which][skill] || 0;
      wiz.state.skillRanks[which][skill] = Math.max(0, current - 1);
      await rerender();
    });
  }

  async _pickerActionSimpleApply(action, selectedId, dlg, applyFn) {
    if (action === "close") {
      dlg.close();
      return;
    }
    if (action === "apply" && selectedId) {
      applyFn(selectedId);
      this.render();
      dlg.close();
    }
  }

  async _pickerActionClass(action, selectedId, dlg) {
    if (action === "close") {
      dlg.close();
      return;
    }
    const choice = this.classChoices.find((c) => c.uuid === selectedId);
    if (!choice || !this._isClassAvailable(choice).ok) return;
    if (action === "set-primary") {
      this.state.classes.primary = selectedId;
      if (!this.state.classLevels.primary) this.state.classLevels.primary = 1;
      this.state.activeClassUuid = selectedId;
      this.render();
      dlg.close();
    } else if (action === "set-secondary") {
      if (!game.settings.get("CTS-DND-35", "enableGestalt")) return;
      this.state.classes.secondary = selectedId;
      this.state.activeClassUuid = selectedId;
      this.render();
      dlg.close();
    }
  }

  async _pickerActionFeat(action, selectedId, dlg) {
    if (action === "close") {
      dlg.close();
      return;
    }
    if (action !== "add-feat") return;
    const uuid = selectedId;
    if (!uuid || this.state.selectedFeatUuids.includes(uuid)) return;
    const feat = this.featChoices.find((f) => f.uuid === uuid);
    if (feat) {
      const finalAbilities = this._finalAbilitiesPlain();
      const check = evaluateFeatPrerequisites({
        prereqText: feat.prerequisites,
        abilities: Object.fromEntries(Object.entries(finalAbilities).map(([k, v]) => [k, { value: v }])),
        bab: this.actor.system?.attributes?.bab?.total || 0,
        totalLevel: 1,
        knownFeatNames: getKnownFeatNames(this.actor),
        allFeatNames: this.featChoices.map((f) => f.name),
        featName: feat.name,
        actor: this.actor,
        skillCatalog: CTSDND35.skills
      });
      if (!check.ok) return;
    }
    const slotLimit = Math.max(1, Number(this.state.featSlots) || 1);
    if (this.state.selectedFeatUuids.length >= slotLimit) return;
    this.state.selectedFeatUuids.push(uuid);
    this.state.activeFeatUuid = uuid;
    this.render();
    await dlg.render();
  }

  async _pickerActionSpell(action, selectedId, dlg) {
    if (action === "close") {
      dlg.close();
      return;
    }
    if (action !== "add-spell") return;
    const uuid = selectedId;
    if (!uuid || this.state.selectedSpellUuids.includes(uuid)) return;
    const spell = this.spellChoices.find((s) => s.uuid === uuid);
    const lvlKey = String(Number(spell?.spellLevel) || 0);
    const selectedByLevel = this._selectedSpellCountsByLevel();
    const levelCap = Number(this.state.spellPickCapsByLevel?.[lvlKey]) || 0;
    if (levelCap <= 0) return;
    if ((selectedByLevel[lvlKey] || 0) >= levelCap) return;
    if (this.state.spellPickCap > 0 && this.state.selectedSpellUuids.length >= this.state.spellPickCap) return;
    this.state.selectedSpellUuids.push(uuid);
    this.state.activeSpellUuid = uuid;
    this.render();
    await dlg.render();
  }

  async _pickerActionSkill(action, _selectedId, dlg) {
    if (action === "close") dlg.close();
  }

  activateListeners(html) {
    super.activateListeners(html);
    
    // Navigation via clickable tabs
    html.find(".step-indicator").click((ev) => {
      ev.preventDefault();
      const step = Number(ev.currentTarget.dataset.step) || 1;
      this.state.step = Math.min(8, Math.max(1, step));
      this.render();
    });

    html.find(".open-picker").click((ev) => {
      ev.preventDefault();
      const kind = ev.currentTarget.dataset.kind;
      const id = ev.currentTarget.dataset.id || "";
      if (!kind) return;
      this._openPicker(kind, id);
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
        } else if (prop === "classSearch") {
          this.state.classSearch = el.value;
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

    html.find(".remove-feat").click((ev) => {
      ev.preventDefault();
      const uuid = ev.currentTarget.dataset.uuid;
      this.state.selectedFeatUuids = this.state.selectedFeatUuids.filter((u) => u !== uuid);
      this.render();
    });

    html.find(".toggle-unavailable").click((ev) => {
      ev.preventDefault();
      this.state.showUnavailable = !this.state.showUnavailable;
      this.render();
    });

    html.find(".remove-spell").click((ev) => {
      ev.preventDefault();
      const uuid = ev.currentTarget.dataset.uuid;
      this.state.selectedSpellUuids = this.state.selectedSpellUuids.filter((u) => u !== uuid);
      this.render();
    });

    html.find(".ability-inc").click((ev) => {
      ev.preventDefault();
      const ability = ev.currentTarget.dataset.ability;
      if (!ability || !(ability in this.state.abilities)) return;
      this.state.abilities[ability] = Math.min(18, (Number(this.state.abilities[ability]) || 8) + 1);
      this.render();
    });

    html.find(".ability-dec").click((ev) => {
      ev.preventDefault();
      const ability = ev.currentTarget.dataset.ability;
      if (!ability || !(ability in this.state.abilities)) return;
      this.state.abilities[ability] = Math.max(8, (Number(this.state.abilities[ability]) || 8) - 1);
      this.render();
    });

    html.find(".cancel-wizard").click((ev) => {
      ev.preventDefault();
      this.close();
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
    const selectedByLevel = this._selectedSpellCountsByLevel();
    for (const [lvl, count] of Object.entries(selectedByLevel)) {
      const levelCap = Number(this.state.spellPickCapsByLevel?.[lvl]) || 0;
      if (count > levelCap) {
        ui.notifications.warn(`Too many level ${lvl} starting spells selected (${count}/${levelCap}).`);
        return;
      }
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
      "system.details.gender": basics.gender || "male",
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
          featName: featMeta.name,
          actor: this.actor,
          skillCatalog: CTSDND35.skills
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
