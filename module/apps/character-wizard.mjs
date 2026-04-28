import { CTSDND35 } from "../helpers/config.mjs";

export class CharacterWizard extends foundry.appv1.applications.Application {
  constructor(actor, options = {}) {
    super(options);
    this.actor = actor;
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
      rolls: []
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

  getData() {
    const context = super.getData();
    context.actor = this.actor;
    context.state = this.state;
    context.config = CTSDND35;
    
    context.isStep1 = this.state.step === 1;
    context.isStep2 = this.state.step === 2;
    
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
    
    return context;
  }

  activateListeners(html) {
    super.activateListeners(html);
    
    // Navigation
    html.find(".next-step").click(ev => {
      this.state.step++;
      this.render();
    });
    html.find(".prev-step").click(ev => {
      this.state.step--;
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

    await this.actor.update(updates);
    ui.notifications.info(`Character Wizard completed for ${basics.name}!`);
    this.close();
  }
}
