/**
 * Scene light presets on the environment tab and the left-hand scene tools.
 * Also registers low-light and blindsight vision so those senses match the preset.
 */

import { applyLightingPreset, LIGHTING_PRESETS } from "../helpers/lighting.mjs";
import { applySensesToTokens } from "./token-combat.mjs";

function registerVisionModes() {
  const modes = CONFIG.Canvas?.visionModes;
  const VisionMode = modes?.basic?.constructor;
  if (!VisionMode) return;
  if (!modes.ctsLowLight) {
    modes.ctsLowLight = new VisionMode({
      id: "ctsLowLight",
      label: "Low-light vision",
      lighting: {
        levels: {
          [VisionMode.LIGHTING_LEVELS.DIM]: VisionMode.LIGHTING_LEVELS.BRIGHT,
        },
        background: { visibility: VisionMode.LIGHTING_VISIBILITY.REQUIRED },
      },
      vision: {
        darkness: { adaptive: true },
        defaults: { attenuation: 0, contrast: 0, saturation: 0, brightness: 0.05 },
      },
    });
  }
  if (!modes.blindsight && modes.tremorsense) {
    modes.blindsight = new VisionMode({
      id: "blindsight",
      label: "Blindsight",
      canvas: {
        shader: modes.tremorsense.canvas.shader,
        uniforms: { contrast: 0, saturation: -0.35, brightness: 0.1 },
      },
      lighting: {
        background: { visibility: VisionMode.LIGHTING_VISIBILITY.DISABLED },
        illumination: { visibility: VisionMode.LIGHTING_VISIBILITY.DISABLED },
        coloration: { visibility: VisionMode.LIGHTING_VISIBILITY.DISABLED },
        darkness: { visibility: VisionMode.LIGHTING_VISIBILITY.DISABLED },
      },
      vision: {
        darkness: { adaptive: false },
        defaults: { attenuation: 0, contrast: 0, saturation: -0.15, brightness: 0.35 },
      },
    });
  }
}

function currentPresetId() {
  try {
    return canvas.scene?.getFlag("CTS-DND-35", "lighting") || "";
  } catch {
    return "";
  }
}

function injectLightingPicker(app, element) {
  const root = element instanceof HTMLElement ? element : element?.[0];
  const tab = root?.querySelector?.('[data-tab="environment"]');
  if (!tab || tab.querySelector(".cts-lighting")) return;
  const scene = app.document;
  const current = scene?.getFlag?.("CTS-DND-35", "lighting") || "";
  const preset = LIGHTING_PRESETS[current];
  const fieldset = document.createElement("fieldset");
  fieldset.className = "cts-lighting";
  const buttons = Object.values(LIGHTING_PRESETS).map((entry) => {
    const active = entry.id === current ? " active" : "";
    return `<button type="button" class="cts-lighting-choice${active}" data-lighting="${entry.id}">
      <i class="${entry.icon}"></i> ${entry.label}
    </button>`;
  }).join("");
  fieldset.innerHTML = `
    <legend>Light</legend>
    <div class="cts-lighting-grid">${buttons}</div>
    <p class="hint">${preset?.blurb || "Pick how the scene is lit. The sliders below are fine-tuning."}</p>
  `;
  tab.prepend(fieldset);
  fieldset.querySelectorAll("[data-lighting]").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      await applyLightingPreset(scene, button.dataset.lighting);
    });
  });
}

async function refreshSensesOnScene(scene) {
  const actors = new Set();
  for (const token of scene.tokens || []) {
    if (token.actor) actors.add(token.actor);
  }
  for (const actor of actors) {
    try {
      await applySensesToTokens(actor, scene);
    } catch (err) {
      console.warn("CTS DND 3.5 | Could not refresh senses after the light changed.", err);
    }
  }
}

export function registerSceneLighting() {
  registerVisionModes();

  Hooks.on("getSceneControlButtons", (controls) => {
    if (!game.user?.isGM || !controls || Array.isArray(controls)) return;
    const current = currentPresetId();
    const preset = LIGHTING_PRESETS[current];
    const tools = {};
    let order = 0;
    for (const entry of Object.values(LIGHTING_PRESETS)) {
      tools[entry.id] = {
        name: entry.id,
        title: `${entry.label}. ${entry.blurb}`,
        icon: entry.icon,
        button: true,
        order: order++,
        onChange: () => {
          const scene = canvas.scene;
          if (scene) applyLightingPreset(scene, entry.id);
        },
      };
    }
    controls.ctsLighting = {
      name: "ctsLighting",
      title: preset ? `Light — ${preset.label}` : "Light",
      icon: preset?.icon || "fa-solid fa-sun",
      order: 20,
      visible: true,
      tools,
    };
  });

  Hooks.on("renderSceneConfig", (app, element) => {
    try {
      injectLightingPicker(app, element);
    } catch (err) {
      console.warn("CTS DND 3.5 | Could not add lighting choices to the scene.", err);
    }
  });

  Hooks.on("updateScene", (scene, changes) => {
    const lighting = changes?.flags?.["CTS-DND-35"];
    if (!lighting || !Object.prototype.hasOwnProperty.call(lighting, "lighting")) return;
    refreshSensesOnScene(scene);
  });
}
