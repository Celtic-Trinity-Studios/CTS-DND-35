# D&D 3.5 Mechanics — Gap Analysis (CTS-DND-35)

This document maps **D&D 3.5 / SRD-level mechanics** against **CTS-DND-35** in one consolidated pass. Use it for roadmap and prioritization—**not** as a claim of parity with any third-party product.

**Reference only (do not copy code or non-OGL content):** [Dragonshorn D35E — Release 3.0.0](https://gitlab.com/dragonshorn/D35E/-/releases/3.0.0). Those notes illustrate how deep Foundry automation *can* go (threat overlays, slot enforcement, formula helpers, ammo/treasure tooling, senses on tokens, etc.). CTS should implement **SRD/OGL** (and your house rules), not proprietary implementations.

**Legend**

| Status | Meaning |
|--------|---------|
| **Present** | Implemented in templates/code/packs at a usable level |
| **Partial** | Data or UI exists; rule is incomplete, manual, or pack-dependent |
| **Missing** | No meaningful first-class support |

**Code pointers (common)** — `module/documents/actor.mjs`, `module/helpers/config.mjs`, `module/helpers/progression-rules.mjs`, `module/apps/character-wizard.mjs`, `module/apps/level-up-wizard.mjs`, `module/utils/trade-modifiers.mjs`, item sheets under `templates/item/`.

---

## Executive summary

CTS-DND-35 is a **strong structural base**: full **skill catalog**, **ability mods**, **BAB from class items**, **core AC** (armor/shield/natural/size/Dex-to-armor cap), **initiative & save totals**, **grapple total**, **HP fields**, **currency**, **many item types** (weapon, armor, spell, class, race, feat, feature, buff, attack, faction, consumable, equipment), **character & level-up wizards** with feat prereq parsing, **faction/trade** subsystem, **grid/diagonal settings**, and **multiple SRD compendia**.

The largest systemic gap is a **unified modifier pipeline** (items/feats/buffs/conditions → derived stats). Without it, **most advanced 3.5** (stacking bonuses, AoOs, flanking, slots, encumbrance ACP, spell slots/DC, DR/resist, conditions, canvas threat) stays **manual or absent**. Secondary gaps: **spellcasting workflow**, **equipment rules**, **special combat actions**, **monster/treasure tooling**.

---

## 1. Character fundamentals

| Topic | Status | Notes / gaps |
|-------|--------|----------------|
| Ability scores & modifiers | **Present** | `prepareDerivedData` → `mod = floor((score−10)/2)` per ability |
| Ability damage / drain / burn | **Missing** | No temporary score layers or penalty tracking |
| Hit points (current / max / temp / nonlethal) | **Present** | Sheet inputs; **dying**, stabilization, death threshold, massive damage — not automated |
| Constitution changes & HP | **Missing** | No rule when Con changes (current vs max interaction) |
| Level (total) | **Present** | Sum of **class** item levels (`actor.mjs`) |
| Experience points & next level | **Partial** | Fields exist; wizards; **XP awards**, **multiclass XP penalty**, **LA buyoff** — not modeled |
| Favored class / multiclass XP penalty | **Missing** | |
| Race (SRD quick picks) | **Partial** | `config.mjs` racial presets + **race** items; **traits not auto-applied** to speed/abilities/skills centrally |
| Size category | **Present** | `traits.size`; feeds AC size mod & grapple |
| Reach by size / creature | **Partial** | Not on token; no default reach table wired to combat |
| Speed — land / fly / swim / climb / burrow | **Partial** | Stored + fly maneuverability; **armor speed**, **encumbrance speed**, **difficult terrain** — not applied |
| Alignment | **Present** | Stored; used in **feat** prereq checks |
| Deity, gender, biography, notes | **Present** | Narrative fields |
| Age, height, weight, eyes/hair | **Missing** | Optional descriptive fields not standardized |
| Languages | **Missing** | No language list / literacy tracker |
| Vision & senses (darkvision, low-light, etc.) | **Missing** | Not aggregated to actor/token (contrast D35E feat-granted senses) |
| Level drain / negative levels | **Missing** | |
| Creature type / subtype (PC) | **Missing** | Monsters rely on manual stats; no PC type field |

---

## 2. Classes, leveling, multiclass, prestige

| Topic | Status | Notes / gaps |
|-------|--------|----------------|
| Class as **Item** | **Present** | Levels, BAB progression type, tied to wizards |
| BAB derived from all class levels | **Present** | Tables in `config.mjs`; summed in `actor.mjs` |
| Base saves from class + level | **Partial** | Save **total** uses manual **base** inputs; **not** computed from per-class good/poor tables |
| Hit dice / HP at level 1 & beyond | **Partial** | Level-up wizard supports **fixed / roll / manual** style flow; full HD averaging rules table-side |
| Skill points per level | **Partial** | Wizard + `getSkillRankCap`; multiclass **class skill lists** merged from packs |
| Max ranks (class / cross-class) | **Present** | `getSkillRankCap` |
| Class skill flags on sheet | **Present** | Per-skill class checkbox |
| Starting wealth / gear at level 1 | **Missing** | Not enforced |
| Prestige classes | **Partial** | Same **class** item; **entry requirements** beyond feats not systematically enforced |
| Gestalt | **Partial** | `enableGestalt` setting; depth depends on wizard |
| NPC class vs PC class | **Partial** | Data can exist in packs; no separate NPC-class workflow |
| Spellcasting progression metadata | **Partial** | `getSpellcastingProgression` etc. in `progression-rules`; **slot/spells-known execution** thin |

---

## 3. Skills

| Topic | Status | Notes / gaps |
|-------|--------|----------------|
| Full SRD skill list | **Present** | `CTSDND35.skills` |
| Trained-only skills | **Present** | `untrained` flag in config; enforcement on roll — **soft** |
| Ranks, ability mod, misc, **total** | **Present** | `actor.mjs` `_prepareSkills` |
| Class skill vs cross-class **cost** | **Partial** | `getSkillPointCost` exists; wizard applies; **sheet direct-edit** can desync |
| Skill synergies | **Missing** | Must use misc |
| Armor check penalty on skills | **Missing** | Armor has no ACP field wired to skills |
| Fatigue / encumbrance to skills | **Missing** | |
| Tools & masterwork tools | **Missing** | |
| Taking 10 / Taking 20 | **Missing** | |
| Aid another | **Missing** | |
| Retry rules / special durations | **Missing** | |
| Individual skill APIs (e.g. Craft income, Decipher page/week) | **Missing** | Use narrative / manual |
| Knowledge checks vs DC tables | **Missing** | |
| Use Rope, Swim with armor | **Missing** | |

---

## 4. Feats, traits, class features

| Topic | Status | Notes / gaps |
|-------|--------|----------------|
| **Feat** items & list | **Present** | Character sheet list |
| Prerequisite parser | **Partial** | `evaluateFeatPrerequisites`: abilities, BAB, level, alignment axes, feat names, **some** skills/race/features |
| Fighter bonus feat slots / scaling | **Partial** | Wizard tracks selections; **no** global “feat slot budget” vs sources |
| Metamagic feats | **Missing** | No heightening workflow tied to spells |
| Item creation feats | **Missing** | |
| Passive numeric bonuses from feats | **Partial** | No **Changes**/effect aggregation |
| **Feature** items (class features) | **Present** | Stored; mechanics manual |
| **Race** items | **Present** | Stored; mechanics manual |
| Alternate racial traits / subraces | **Partial** | Pack content only |

---

## 5. Combat — attacks & damage

| Topic | Status | Notes / gaps |
|-------|--------|----------------|
| **Weapon** / **attack** items | **Present** | Types exist |
| Melee attack bonus decomposition | **Partial** | Not one pipeline (BAB + Str/Dex + size + enhancement + morale + luck + …) |
| Ranged attacks | **Partial** | Same; range increments / cover not automated |
| Iterative attacks (BAB −5, −10, …) | **Missing** | |
| Natural weapons & secondary attacks | **Missing** | |
| Touch attacks / ranged touch | **Partial** | AC touch computed; **attack mode** not distinguished in automation |
| Critical threat / confirmation / multiplier | **Missing** | |
| Damage rolls & chat cards | **Partial** | Basic `Item.roll()` chat output |
| Damage types (B/S/P) & energy types | **Partial** | Schema varies by item; **DR interaction** missing |
| Precision damage (sneak attack, etc.) | **Missing** | |
| Nonlethal damage | **Partial** | HP field exists; **weapon toggle / track** not wired |
| Weapon size / inappropriate size | **Missing** | |
| Two-weapon fighting penalties | **Missing** | |
| Power Attack / Combat Expertise sliders | **Missing** | |

---

## 6. Combat — AC, saves, resistances

| Topic | Status | Notes / gaps |
|-------|--------|----------------|
| AC (normal) | **Partial** | 10 + armor + shield + capped Dex + size + natural |
| Touch AC | **Present** | Derived line |
| Flat-footed AC | **Present** | Derived line |
| Dodge, deflection, insight, sacred, profane, luck, misc AC | **Missing** | Not item-driven; use house manual change to natural/bonus fields if at all |
| Max Dex bonus from armor | **Present** | Lowest equipped armor `maxDex` caps Dex to AC |
| Shield spell / force effects | **Missing** | |
| Saving throws (Fort / Ref / Will total) | **Partial** | Base + ability + misc; base should tie to classes |
| Saving throw bonuses by source | **Missing** | No typed stacking |
| Damage reduction (DR) | **Missing** | |
| Energy resistance / immunity | **Missing** | |
| Spell resistance (SR) | **Partial** | Numeric field; **no** caster check workflow |
| Hardness & object HP | **Missing** | |
| Miss chance (concealment / blur / displacement) | **Missing** | |

---

## 7. Combat — actions, movement, positioning

| Topic | Status | Notes / gaps |
|-------|--------|----------------|
| Initiative order | **Present** | Foundry combat + sheet initiative roll |
| Turn structure (standard / move / swift / immediate / full-round) | **Missing** | |
| Delay / ready | **Missing** | |
| Charge, withdraw, run, tumble through threatened squares | **Missing** | |
| 5-foot step | **Missing** | |
| Grappling rules (initiate, hold, pin, damage, escape) | **Missing** | Grapple **modifier** shown only |
| Trip, bull rush, overrun, disarm, sunder, feint | **Missing** | |
| Mounted combat | **Missing** | |
| Reach weapons & threatened squares | **Missing** | No geometry (D35E-style overlays absent) |
| Flanking (+2 melee) | **Missing** | |
| Attacks of opportunity | **Missing** | No counter / provoke logic |
| Cover / concealment modifiers | **Missing** | |
| Higher ground, squeezing | **Missing** | |

---

## 8. Conditions, healing, death

| Topic | Status | Notes / gaps |
|-------|--------|----------------|
| **Buff** item type | **Present** | Exists; **duration / combat-round** automation thin |
| SRD condition catalog (applied effects) | **Missing** | |
| Foundry **Active Effects** driving mods | **Missing** | `prepareDerivedData` does not consume unified effects |
| Fatigued / exhausted track | **Missing** | |
| Shaken / frightened / panicked | **Missing** | |
| Nauseated / sickened | **Missing** | |
| Stunned / dazed / helpless | **Missing** | |
| Invisible / blind | **Missing** | Foundry vision separate from 3.5 miss rules |
| Poison & disease (frequency, DC track) | **Missing** | |
| Stable / dying / dead | **Missing** | |
| Natural healing / long-term care | **Missing** | |
| Raise dead / restoration (spell effects) | **Missing** | |

---

## 9. Equipment & inventory

| Topic | Status | Notes / gaps |
|-------|--------|----------------|
| Weapons, armor, shields, goods | **Present** | Item types + sheets |
| Equipped flag (armor/shield) | **Present** | Feeds AC |
| Weapon stats (damage, crit, type, reach flags in data?) | **Partial** | Pack-dependent; not validated |
| Armor stats (bonus, max Dex, ACP, arcane spell failure, speed) | **Partial** | AC bonus & maxDex used; **ACP / ASF / speed penalty** fields if present — **not** wired globally |
| Magic enhancement (+1 armor / weapon) | **Partial** | Some fields on armor |
| Material (cold iron, silver, adamantine) | **Missing** | |
| Weapon sizing & handedness | **Missing** | |
| Ammunition & consumption | **Missing** | No ammo items workflow (see D35E patterns for reference only) |
| Charges / per-day item uses | **Partial** | Schema possible; no universal UI |
| Weight & encumbrance | **Missing** | |
| Load limits by Strength | **Missing** | |
| Body slots (ring ×2, head, eyes, …) | **Missing** | |
| Slotless / combining rules | **Missing** | |
| Drawing / sheathing / dropping | **Missing** | |
| Breaking / sundering gear | **Missing** | |

---

## 10. Spells & divine casting

| Topic | Status | Notes / gaps |
|-------|--------|----------------|
| **Spell** items & per-level lists | **Partial** | Sheet lists by level |
| Spell preparation (Vancian) | **Missing** | |
| Spontaneous casting (known spells / slots) | **Missing** | |
| Spell slots per level | **Missing** | |
| Caster level (global per class) | **Partial** | Not centralized on actor for checks |
| Spell DC (10 + level + ability) | **Missing** | |
| Spell resistance check | **Missing** | |
| Concentration (DC = 10 + damage + spell level, etc.) | **Missing** | Skill exists only as static total |
| Components V / S / M / F / DF / XP | **Partial** | Text on items at best |
| Arcane spell failure chance | **Missing** | Not applied from armor |
| Counterspells | **Missing** | |
| Dispel magic / buff stacking rules | **Missing** | |
| Domains & domain spells | **Partial** | **srd-domains** pack; linkage to preparation missing |
| Turn / rebuke undead | **Missing** | |
| Divine spell morality (cleric alignment) | **Missing** | |

---

## 11. Psionics (SRD Expanded — if used)

| Topic | Status | Notes / gaps |
|-------|--------|----------------|
| Power **Item** compendium | **Partial** | `srd-powers` pack exists |
| Power points | **Missing** | |
| Manifester level / discipline | **Missing** | |
| Display / augment | **Missing** | |

---

## 12. Monsters & NPCs

| Topic | Status | Notes / gaps |
|-------|--------|----------------|
| **NPC** actor sheet | **Present** | Includes trade / factions tab |
| Challenge Rating field | **Partial** | Usable as label; encounter CR math not system-owned |
| Monster ability scores & skills | **Partial** | Same model as PCs; **good saves / synergy** manual |
| Special attacks & qualities | **Partial** | Narrative + manual stats |
| Treasure type / encounter loot tables | **Missing** | D35E-style treasure % + generator — absent |
| Advancement by HD / templates | **Missing** | |
| Summoned creatures / generic tokens | **Missing** | |

---

## 13. Environment & hazards

| Topic | Status | Notes / gaps |
|-------|--------|----------------|
| Falling damage | **Missing** | |
| Suffocation / drowning | **Missing** | |
| Fire / cold environmental damage | **Missing** | |
| Light sources vs darkvision radius | **Missing** | Foundry lighting ≠ SRD radii rules |
| Weather & forced saves | **Missing** | |
| Traps (Search / Disable / Reflex) | **Missing** | |

---

## 14. Social play & downtime

| Topic | Status | Notes / gaps |
|-------|--------|----------------|
| Diplomacy / Gather Information DC scaffolding | **Missing** | Skills roll only |
| Intimidate / Bluff opposed checks | **Missing** | |
| Urban encounters / reputation | **Missing** | |

---

## 15. Economy & CTS-specific systems

| Topic | Status | Notes / gaps |
|-------|--------|----------------|
| Currency (cp/sp/gp/pp) | **Present** | Actor field |
| Craft / Profession income | **Missing** | |
| Treasure allocation | **Missing** | |
| **Faction** items & Gear % stacking | **Present** | Trade buyer modifiers |
| Race-based buyer/seller trade % | **Present** | NPC sheet + `computeGearPricePercentTotal` |
| Item pricing helpers | **Partial** | `adjustedGearPrice`; full SRD price tables not enforced |

---

## 16. Canvas, tokens & Foundry integration

| Topic | Status | Notes / gaps |
|-------|--------|----------------|
| Token ↔ actor link | **Present** | Foundry default |
| Vision modes on token | **Present** | Foundry; not driven by 3.5 sense aggregation |
| Grid diagonal policy (3.5 style) | **Present** | System setting enforces 5-10-5 option |
| Template placement / areas | **Missing** | Foundry tools manual |
| Measured templates & spell areas | **Missing** | Not spell-aware |

---

## 17. UX, macros & authoring (benchmark vs D35E 3.0)

Capabilities described in [D35E 3.0.0](https://gitlab.com/dragonshorn/D35E/-/releases/3.0.0) as **aspirational** targets for any deep 3.5 Foundry system—not a CTS requirement list.

| Capability | CTS status |
|------------|------------|
| Threatened-area overlay & reach-aware melee | **Missing** |
| Automatic flanking / threat detection at attack time | **Missing** |
| Formula builder / `@variable` picker on item fields | **Missing** |
| Equipment slot enforcement + bonus slots from effects | **Missing** |
| Advanced ammunition (no consume / ammo damage riders) | **Missing** |
| NPC treasure blocks & treasure generator hooks | **Missing** |
| Optional heavy combat tracker (actions, AoOs, buff ticks) | **Missing** |

---

## 18. Suggested roadmap (ordered)

1. **Modifier pipeline** — One path: equipped items + buffs + conditions → AC components, saves, skills, speed, AB, damage (Active Effects or custom Changes).
2. **Armor & encumbrance** — ACP, ASF, speed reduction, weight, loads; skill penalties.
3. **Combat core** — Crit pipeline, DR/resist, energy types, iterative attacks (even if manual toggles first).
4. **Spellcasting** — Slots, DC, CL, concentration helper, ASF application.
5. **Special actions** — AoO counter, flanking flag, reach field on weapon/token (automation can follow).
6. **Canvas polish** — Threat overlays last (depends on reliable reach & disposition).

---

## 19. Maintaining this document

- After shipping a feature, change **Missing** → **Partial** → **Present** and add the owning path (`module/…`, `templates/…`).
- Add a **Non-goals** subsection if you intentionally stay theatre-of-the-mind for some rows.

---

*CTS-DND-35 mechanics audit (single pass). Reference benchmark: [D35E 3.0.0 release notes](https://gitlab.com/dragonshorn/D35E/-/releases/3.0.0).*
