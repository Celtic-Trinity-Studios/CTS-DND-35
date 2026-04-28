import { CTSDND35 } from "../helpers/config.mjs";

export class CharacterWizard extends Application {
  constructor(actor, options = {}) {
    super(options);
    this.actor = actor;
    this.featChoices = [];
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
      selectedFeatUuid: "",
      skillRanks: this._initSkillRanks()
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
    const context = super.getData() ?? {};
    context.actor = this.actor;
    context.state = this.state;
    context.config = CTSDND35;
    
    context.isStep1 = this.state.step === 1;
    context.isStep2 = this.state.step === 2;
    context.isStep3 = this.state.step === 3;
    
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
    const baseSkillPoints = Math.max(1, 2 + intMod);
    const humanBonus = this.state.basics.race === "human" ? 1 : 0;
    context.skillPointBudget = (baseSkillPoints + humanBonus) * 4;
    context.skillPointSpent = Object.values(this.state.skillRanks).reduce((sum, n) => sum + (Number(n) || 0), 0);
    context.skillPointRemaining = context.skillPointBudget - context.skillPointSpent;

    await this._loadFeatChoices();
    context.featChoices = this.featChoices;
    
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

    const index = await pack.getIndex({ fields: ["name"] });
    this.featChoices = index
      .map((entry) => ({
        uuid: `Compendium.${pack.collection}.${entry._id}`,
        name: entry.name
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  activateListeners(html) {
    super.activateListeners(html);
    
    // Navigation
    html.find(".next-step").click(ev => {
      this.state.step = Math.min(3, this.state.step + 1);
      this.render();
    });
    html.find(".prev-step").click(ev => {
      this.state.step = Math.max(1, this.state.step - 1);
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
        } else if (prop === "selectedFeatUuid") {
          this.state.selectedFeatUuid = el.value;
        } else if (prop.startsWith("skills.")) {
          const key = prop.split(".")[1];
          this.state.skillRanks[key] = Math.max(0, parseInt(el.value) || 0);
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
  }

  async _applyToActor() {
    const { basics, abilities } = this.state;
    const raceDef = CTSDND35.races[basics.race];
    
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
    };

    for (let a of ["str", "dex", "con", "int", "wis", "cha"]) {
      updates[`system.abilities.${a}.value`] = finalAbilities[a];
    }

    for (const [skillKey, ranks] of Object.entries(this.state.skillRanks)) {
      updates[`system.skills.${skillKey}.ranks`] = ranks;
      updates[`system.skills.${skillKey}.misc`] = 0;
      updates[`system.skills.${skillKey}.classSkill`] = false;
    }

    await this.actor.update(updates);

    if (this.state.selectedFeatUuid) {
      const featDoc = await fromUuid(this.state.selectedFeatUuid);
      if (featDoc) {
        await this.actor.createEmbeddedDocuments("Item", [featDoc.toObject()]);
      }
    }

    this.actor.sheet?.render(true);
    ui.notifications.info(`Character Wizard completed for ${basics.name}!`);
    this.close();
  }
}
