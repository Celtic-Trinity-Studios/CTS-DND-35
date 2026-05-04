# CTS DND 3.5 — Custom D&D 3.5 Edition System

A clean, extensible Foundry VTT system for D&D 3.5 Edition, built from scratch by **Celtic Trinity Studios**.

## Status

**v0.1.0** — Foundation scaffold. All files are in place, the system will load in Foundry VTT v14.

## Installation

### Via Foundry VTT (Recommended)

1. In Foundry VTT, go to **Settings → Game Systems → Install System**
2. Paste this manifest URL:
   ```
   https://github.com/Celtic-Trinity-Studios/CTS-DND-35/releases/latest/download/system.json
   ```
3. Click **Install**

Updates will appear automatically in Foundry when a new release is published.

### Manual Installation

1. Download the latest `CTS-DND-35.zip` from [Releases](https://github.com/Celtic-Trinity-Studios/CTS-DND-35/releases)
2. Extract to your Foundry VTT `Data/systems/` directory
3. Restart Foundry VTT

## Releasing a New Version

1. Update `version` in `system.json`
2. Commit and push
3. Tag the commit: `git tag v0.1.0 && git push origin v0.1.0`
4. GitHub Actions automatically creates a release with the zip and updated manifest

## Project Structure

```
CTS-DND-35/
├── system.json              # System manifest (install/update URL)
├── template.json            # Actor & Item data schema
├── css/
│   └── cts-dnd-35.css       # System stylesheet
├── lang/
│   └── en.json              # English localization
├── module/
│   ├── cts-dnd-35.mjs       # Main entry point
│   ├── documents/
│   │   ├── actor.mjs        # Custom Actor document
│   │   └── item.mjs         # Custom Item document
│   ├── helpers/
│   │   ├── config.mjs       # System constants & tables
│   │   └── templates.mjs    # Template preloader
│   └── sheets/
│       ├── actor-sheet.mjs  # Actor sheet class
│       └── item-sheet.mjs   # Item sheet class
├── templates/
│   ├── actor/               # Character & NPC sheet templates
│   └── item/                # Item type sheet templates
├── assets/                  # Images and icons
├── packs/                   # Compendium packs (future)
└── .github/workflows/
    └── release.yml          # Automated release pipeline
```

## Using features in your game

In-world setup for merchants, currency, and trade rules is documented here:

**[docs/WORLD-FEATURES.md](docs/WORLD-FEATURES.md)** — NPC shop (stocking, pricing, buy/sell, permissions), trade modifiers, and troubleshooting.

Installed worlds also have a copy under **`systems/CTS-DND-35/docs/WORLD-FEATURES.md`** inside your Foundry user Data folder (bundled in the system zip since v0.4.85).

Mechanic gaps and audits stay under `docs/` as separate references.

## What's Included

- **Actor Types**: Character, NPC
- **Item Types**: Weapon, Armor, Equipment, Consumable, Feat, Feature, Spell, Class, Race, Buff, Attack
- **SRD-Accurate**: Ability modifiers, BAB/save progression tables, size modifiers, spell schools, alignments
- **Rollable**: Ability checks, saving throws, initiative
- **Extensible**: Clean module pattern, config-driven constants, template composition
- **Foundry v14 Compatible**: ES modules, modern API patterns
- **Auto-Update**: Install via manifest URL, updates delivered through GitHub Releases

## License

Content derived from the d20 SRD is released under the Open Game License (OGL).
