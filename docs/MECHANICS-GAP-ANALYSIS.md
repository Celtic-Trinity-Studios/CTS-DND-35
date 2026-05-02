# D&D 3.5 Mechanics — Gap Analysis (CTS-DND-35)

This document maps **D&D 3.5 / SRD-level mechanics** against **CTS-DND-35** today. It is for planning and prioritization, not legal comparison of third-party systems.

**Reference only (do not copy code or non-OGL content):** [Dragonshorn D35E — Release 3.0.0](https://gitlab.com/dragonshorn/D35E/-/releases/3.0.0). That release notes list illustrates the *depth of automation* a mature Foundry 3.5 implementation may provide (threat overlays, slot enforcement, formula tooling, ammo rules, treasure data, etc.). CTS-DND-35 should implement behavior from the **SRD/OGL** and your own design goals, not from proprietary packages.

**Legend**

| Status | Meaning |
|--------|---------|
| **Present** | Implemented in code/sheets at a usable level |
| **Partial** | Data model or UI exists; rules incomplete or manual |
| **Missing** | Not meaningfully supported yet |

---

## Executive summary

CTS-DND-35 is a **clean, extensible shell**: solid **ability/skill lists**, **derived BAB from class items**, **core AC** (armor/shield/natural/size/Dex cap), **saves/init/grapple** basics, **inventory item types**, **character & level-up wizards**, **feat prerequisite helpers**, **trade/faction pricing**, and **compendium packs**.  

What separates it from a **full tactical + spell + item-rules engine** is mostly: **no unified “changes” pipeline** (buffs/feats/items altering the same derived stats), **limited combat automation** (AoOs, reach, flanking, actions, special attacks), **spellcasting workflow** (slots, preparation, DC/SR/concentration), **equipment depth** (slots, encumbrance, masterwork/magic stacking), and **canvas/token integration** beyond Foundry defaults.

---

## 1. Character fundamentals

| Topic | Status | Notes / gaps |
|-------|--------|----------------|
| Ability scores & mods | **Present** | Computed in `prepareDerivedData`; stored per ability |
| Hit points (current/max/temp/nonlethal) | **Present** | Fields on sheet; dying/stabilization/death rules not automated |
| Level & XP | **Partial** | Total level from **class items**; XP fields exist; level-up wizard; multiclass ordering / XP penalties not deeply modeled |
| Race | **Partial** | Default race table in config + **race** items; automatic application of racial traits to all mechanics is **not** centralized |
| Alignment, deity, bio | **Present** | Mostly narrative fields; alignment used in feat prereqs (`progression-rules`) |
| Size | **Present** | Size mods feed AC/grapple; reach by size not surfaced as token mechanic |
| Speed (land/fly/swim/climb/burrow) | **Partial** | Fields + fly maneuverability; armor speed reduction, encumbrance speed not wired |

---

## 2. Classes, leveling, multiclass

| Topic | Status | Notes / gaps |
|-------|--------|----------------|
| Class items & BAB progression | **Present** | BAB tables by progression type; level per class item |
| Saves from class levels | **Partial** | Save **bases** are editable inputs; **automatic** base saves from class + level tables not derived from class items alone |
| Skill points per level | **Partial** | Wizard logic exists; caps (`getSkillRankCap`) exist; full multiclass skill point stacking verification is ongoing design |
| Prestige classes | **Partial** | Same **class** item type can represent PrC if packs provide data; prereq enforcement beyond feats may be incomplete |
| Gestalt / house rules | **Partial** | Setting flag exists; behavior depth depends on wizards |

---

## 3. Skills

| Topic | Status | Notes / gaps |
|-------|--------|----------------|
| Full 3.5 skill list | **Present** | `config.mjs` defines skills + abilities + untrained flag |
| Ranks, class skill, misc, totals | **Present** | Totals in `actor.mjs`; **synergy bonuses**, **circumstance/racial** as structured modifiers — mostly manual via misc |
| DC tables / skill checks in UI | **Missing** | Roll sends basic flavor; no built-in DC library |
| Taking 10 / 20, aid another | **Missing** | Table workflow not enforced |
| Armor check penalty | **Missing** | Not applied from armor to relevant skills automatically |

---

## 4. Feats & features

| Topic | Status | Notes / gaps |
|-------|--------|----------------|
| Feat items | **Present** | Listed on sheet; prereq evaluation **partial** (`evaluateFeatPrerequisites`) |
| Class / racial features | **Present** | **feature** / **race** items; mechanical effect layer **manual** unless scripted elsewhere |
| Feat types (fighter bonus, etc.) | **Partial** | Depends on pack data and wizard; no global tracker |
| Passive numeric effects from feats | **Partial** | No standard “Changes” pipeline (contrast: D35E-style aggregated modifiers) |

---

## 5. Combat (core)

| Topic | Status | Notes / gaps |
|-------|--------|----------------|
| Attack rolls (weapon / attack items) | **Partial** | Items exist; full attack bonus decomposition (BAB, size, ability, enhancement, morale, etc.) not unified |
| Damage rolls | **Partial** | Chat cards basic in `item.mjs`; crit confirmation / multiplier / precision vs acid etc. not fully modeled |
| AC (normal/touch/flat-footed) | **Partial** | Armor+shield+Dex cap+size+natural; **deflection, dodge, misc bonuses** not item-driven |
| Initiative | **Present** | Rolled from sheet |
| Saving throws | **Partial** | Total = base + ability + misc bonus; base not auto from classes |
| BAB / grapple display | **Present** | Grapple uses SRD-style components |
| Critical hits | **Missing** | No systematic crit range/multiplier pipeline |
| Damage reduction / hardness | **Missing** | Not first-class on actors/items |
| Concealment / miss chance | **Missing** | Not automated |
| Spell resistance | **Partial** | SR value field; **caster level checks vs SR** not integrated into spell workflow |
| Actions (standard/move/swift/immediate/full-round) | **Missing** | No turn economy tracker |
| Attacks of opportunity | **Missing** | No AoO counter or provoke matrix (D35E emphasizes threat/provocation tooling) |
| Reach & threatened area | **Missing** | No reach visualization (D35E 3.0 highlights this) |
| Flanking | **Missing** | No detection / bonus automation |
| Grapple / trip / bull rush / etc. | **Missing** | No structured opposed-check workflows beyond raw rolls |
| Mounted combat | **Missing** | |
| Two-weapon fighting | **Missing** | |

---

## 6. Equipment & inventory

| Topic | Status | Notes / gaps |
|-------|--------|----------------|
| Weapons / armor / gear items | **Present** | Types + sheets |
| Equip flags | **Partial** | Armor uses `equipped` for AC; general slot UX varies |
| Magic enhancement fields | **Partial** | Some enhancement fields on armor; full weapon + ammo + stacking rules incomplete |
| Body slots (ring/neck/head…) | **Missing** | D35E 3.0 documents strict slot enforcement + extra slots via Changes — CTS has **no** slot system |
| Weight & encumbrance | **Missing** | |
| Carrying capacity by Str | **Missing** | |
| Ammunition | **Missing** | No infinite-ammo flags or ammo damage riders (D35E 3.0 describes patterns for this) |
| Charges / uses per day (items) | **Partial** | Depends on item schema; not globally unified |

---

## 7. Spells & magic

| Topic | Status | Notes / gaps |
|-------|--------|----------------|
| Spell items & spell list UI | **Partial** | Grouped by level; editing/casting depth limited |
| Spell slots (per class/level) | **Missing** | No preparation / spontaneous / pact-style tracker |
| Caster level | **Partial** | May exist on items; not centralized for SR/concentration/duration |
| Spell DC (10 + level + ability) | **Missing** | Not automated from sheet |
| Concentration checks | **Missing** | Skill exists; no wound-based DC automation |
| Components (V/S/M/DF/XP) | **Partial** | Narrative on items at best |
| Buff duration / combat tracker tie-in | **Partial** | **buff** item type exists; timeline integration like D35E optional combat tracking **missing** |
| Domain / specialty spell lists | **Partial** | Domains in packs as items; mechanical linkage varies |

---

## 8. Conditions & effects

| Topic | Status | Notes / gaps |
|-------|--------|----------------|
| Foundry Active Effects | **Missing** | Actor prep does not integrate a unified effect-driven modifier stack |
| SRD condition catalog (shaken, nauseated, …) | **Missing** | |
| Darkvision / senses on token | **Missing** | D35E 3.0 mentions feats granting senses to token vision — CTS has no equivalent |

---

## 9. Monsters & NPCs

| Topic | Status | Notes / gaps |
|-------|--------|----------------|
| NPC actor type | **Present** | Sheet includes trade/factions |
| CR | **Partial** | Field/config exists; encounter math not in scope here |
| Treasure type / random treasure | **Missing** | D35E 3.0 adds structured treasure % for generators — CTS **no** treasure generator |
| Monster subtype traits | **Partial** | Depends on manual stats + packs |

---

## 10. Exploration & environment

| Topic | Status | Notes / gaps |
|-------|--------|----------------|
| Light / vision (rules) | **Missing** | Uses Foundry vision; 3.5 light radius rules not enforced |
| Movement modes & terrain | **Partial** | Speed fields; diagonal policy setting exists for grid |
| Skill challenges (Listen/Spot DCs) | **Missing** | |

---

## 11. Social & economy (CTS-specific)

| Topic | Status | Notes / gaps |
|-------|--------|----------------|
| Factions as items + Gear % | **Present** | Custom mechanic; propagation tooling |
| Race-based trade modifiers | **Present** | Buyer/seller rows + API (`trade-modifiers`) |
| Wealth-by-level / item pricing tables | **Partial** | GP tracking exists; SRD wealth guidelines not baked in |

---

## 12. UX, authoring & tooling (benchmark vs D35E 3.0)

These items mirror **capabilities described** in [D35E 3.0.0 release notes](https://gitlab.com/dragonshorn/D35E/-/releases/3.0.0); treat as **product goals**, not as requirements to clone.

| Capability | CTS status |
|------------|------------|
| Threatened-area / flanking visualization | **Missing** |
| Formula builder / variable picker for item formulas | **Missing** |
| Equipment slot enforcement + “grant slot” effects | **Missing** |
| Advanced ammo options (infinite / ammo damage parts) | **Missing** |
| Treasure data + generator hooks | **Missing** |
| Optional advanced combat tracker (actions/AoO icons) | **Missing** |

---

## 13. Suggested implementation phases (for CTS)

Order is subjective; adjust for your table.

1. **Modifiers pipeline** — Single place where equipped items, buffs, and feats apply bonuses/penalties to AC, saves, ability checks, skills, speed (even if UI stays simple). Foundry **Active Effects** or a custom **Changes** array on items are typical approaches.
2. **Combat essentials** — Criticals, DR, basic reach/flanking hooks (even if manual toggles before full geometry).
3. **Spellcasting** — Slots + DC + CL on the actor; concentration helper.
4. **Equipment** — Encumbrance, armor check penalty, body slots.
5. **Canvas automation** — Threat overlays last (high effort; depends on stable attack/reach data).

---

## 14. How to maintain this doc

- When you **ship** a feature, flip the row from **Missing/Partial** to **Present** and point to the owning module/template.
- When scope changes (e.g. “theatre of the mind only”), add a **Non-goals** section so contributors do not chase automation you intentionally omit.

---

*Generated for CTS-DND-35 codebase review. Reference release: [D35E 3.0.0](https://gitlab.com/dragonshorn/D35E/-/releases/3.0.0).*
