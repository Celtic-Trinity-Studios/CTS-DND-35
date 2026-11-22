/**
 * Plain-language scene light. Each preset sets Foundry's darkness grade and
 * global illumination together, so the picture matches who can see.
 *
 * Bands follow the 3.5 illumination rules:
 * bright — no concealment from light
 * shadowy — 20% miss chance unless the viewer has low-light vision or darkvision
 * dark — 50% miss chance outside a light, unless the viewer has darkvision
 * magical — deeper darkness; darkvision does not pierce it
 */

const DAY_BASE = { hue: 0.1, intensity: 0.12, luminosity: 0.12, saturation: 0.08, shadows: 0.05 };
const NIGHT_DARK = { hue: 0.64, intensity: 0.55, luminosity: -0.45, saturation: -0.1, shadows: 0.7 };

function environment({ darknessLevel, global, base = DAY_BASE, dark = NIGHT_DARK }) {
  return {
    darknessLevel,
    darknessLock: false,
    cycle: true,
    globalLight: {
      enabled: global.enabled,
      bright: global.bright,
      color: global.color,
      luminosity: global.luminosity,
      saturation: global.saturation ?? 0,
      contrast: 0,
      shadows: global.shadows ?? 0,
      alpha: global.alpha ?? 0.5,
      darkness: { min: 0, max: global.enabled ? 1 : 0 },
    },
    base,
    dark,
  };
}

export const LIGHTING_PRESETS = {
  day: {
    id: "day",
    label: "Bright day",
    icon: "fa-solid fa-sun",
    band: "bright",
    miss: 0,
    blurb: "Sunlight. Everyone can see. Walls still block sight.",
    environment: environment({
      darknessLevel: 0,
      global: { enabled: true, bright: true, color: "#fff1d6", luminosity: 0.55 },
    }),
  },
  overcast: {
    id: "overcast",
    label: "Overcast",
    icon: "fa-solid fa-cloud",
    band: "bright",
    miss: 0,
    blurb: "Cloudy daylight. Still bright, just flatter and cooler.",
    environment: environment({
      darknessLevel: 0.12,
      global: { enabled: true, bright: true, color: "#d5dbe3", luminosity: 0.45, saturation: -0.15 },
      base: { hue: 0.58, intensity: 0.16, luminosity: -0.05, saturation: -0.28, shadows: 0.22 },
    }),
  },
  dusk: {
    id: "dusk",
    label: "Dusk",
    icon: "fa-solid fa-cloud-sun",
    band: "shadowy",
    miss: 20,
    blurb: "Shadowy light. 20% miss chance unless you have low-light vision or darkvision.",
    environment: environment({
      darknessLevel: 0.5,
      global: { enabled: true, bright: false, color: "#e8944a", luminosity: 0.45, alpha: 0.55 },
      dark: { hue: 0.07, intensity: 0.5, luminosity: -0.2, saturation: 0.22, shadows: 0.4 },
    }),
  },
  moon: {
    id: "moon",
    label: "Moonlight",
    icon: "fa-solid fa-moon",
    band: "shadowy",
    miss: 20,
    blurb: "Night, but you can still see poorly. 20% miss chance unless you have low-light vision or darkvision.",
    environment: environment({
      darknessLevel: 0.72,
      global: { enabled: true, bright: false, color: "#b7c7e6", luminosity: 0.3, saturation: -0.1 },
      dark: { hue: 0.62, intensity: 0.55, luminosity: -0.4, saturation: -0.15, shadows: 0.6 },
    }),
  },
  dark: {
    id: "dark",
    label: "Dark",
    icon: "fa-solid fa-dungeon",
    band: "dark",
    miss: 50,
    blurb: "No ambient light. Torches, spells, and darkvision only. Otherwise total concealment (50% miss).",
    environment: environment({
      darknessLevel: 1,
      global: { enabled: false, bright: false, color: "#000000", luminosity: 0 },
      dark: { hue: 0.67, intensity: 0.35, luminosity: -0.55, saturation: -0.25, shadows: 0.8 },
    }),
  },
  magical: {
    id: "magical",
    label: "Magical darkness",
    icon: "fa-solid fa-eye-slash",
    band: "magical",
    miss: 50,
    blurb: "Deeper darkness. Darkvision does not work. Blindsight still does. Turn off lights that should not pierce it.",
    environment: environment({
      darknessLevel: 1,
      global: { enabled: false, bright: false, color: "#000000", luminosity: 0 },
      dark: { hue: 0.76, intensity: 0.48, luminosity: -0.6, saturation: 0.12, shadows: 0.85 },
    }),
  },
};

export function lightingPreset(id) {
  return LIGHTING_PRESETS[id] ?? null;
}

function hasSense(value) {
  return Math.max(0, Number(value) || 0) > 0;
}

function hasLowLight(senses = {}) {
  return senses.lowLightVision === true || senses.lowLightVision === "true";
}

/**
 * One sentence for an attack card. Concealment is about the scene as a whole;
 * a target standing in a torch is brighter than a Dark scene.
 */
export function concealmentNote(presetId, senses = {}) {
  const preset = lightingPreset(presetId);
  if (!preset || preset.miss <= 0) return "";
  const darkvision = hasSense(senses.darkvision);
  const blindsight = hasSense(senses.blindsight) || hasSense(senses.blindsense);
  const lowLight = hasLowLight(senses);
  if (blindsight) return `${preset.label}: blindsight ignores this concealment.`;
  if (preset.band === "magical") {
    return "Magical darkness. Darkvision does not pierce it. A target you cannot otherwise see has total concealment (50% miss).";
  }
  if (preset.band === "dark") {
    if (darkvision) return "Darkness. Your darkvision sees in black and white inside its range, with no concealment from the dark.";
    return "Darkness. Outside a light source the target has total concealment (50% miss).";
  }
  if (preset.band === "shadowy") {
    if (darkvision || lowLight) return `${preset.label}. Your vision treats this shadowy light as clear.`;
    return `${preset.label}. Targets in this light have concealment (20% miss) unless they stand in bright light.`;
  }
  return "";
}

export async function applyLightingPreset(scene, id) {
  const preset = lightingPreset(id);
  if (!scene || !preset) return;
  const merge = foundry.utils.mergeObject;
  const current = scene.environment?.toObject?.() ?? scene.toObject().environment ?? {};
  const environment = merge(current, preset.environment, { inplace: false });
  await scene.update({
    tokenVision: true,
    environment,
    "flags.CTS-DND-35.lighting": id,
  }, { animateDarkness: 600 });
  ui.controls?.render?.({ reset: true });
}
