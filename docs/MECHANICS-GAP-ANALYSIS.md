# D&D 3.5 Mechanics — Gap Analysis (CTS-DND-35)

This document maps **D&D 3.5 / SRD-level mechanics** against **CTS-DND-35** in one consolidated pass. Use it for roadmap and prioritization—**not** as a claim of parity with any third-party product.

**Reference only (do not copy code or non-OGL content):** [Dragonshorn D35E — Release 3.0.0](https://gitlab.com/dragonshorn/D35E/-/releases/3.0.0). Those notes illustrate how deep Foundry automation *can* go (threat overlays, slot enforcement, formula helpers, ammo/treasure tooling, senses on tokens, etc.). CTS should implement **SRD/OGL** (and your house rules), not proprietary implementations.

**Legend**

| Status | Meaning |
|--------|---------|
| **Present** | Implemented in templates/code/packs at a usable level |
| **Partial** | Data or UI exists; rule is incomplete, manual, or pack-dependent |
| **Missing** | No meaningful first-class support |

**Code pointers (common)** — `module/documents/actor.mjs`, `module/helpers/config.mjs`, `module/helpers/progression-rules.mjs`, `module/hooks/actor-character-mechanics.mjs` (Con→HP), `module/sheets/actor-sheet.mjs`, `module/apps/character-wizard.mjs`, `module/apps/level-up-wizard.mjs`, `module/utils/trade-modifiers.mjs`, item sheets under `templates/item/`, character partials `templates/actor/parts/actor-identity.hbs`, `actor-ability-adjustments.hbs`, `actor-combat.hbs`.

---

## Executive summary

CTS-DND-35 is a **strong structural base**: full **skill catalog**, **ability mods**, **BAB from class items**, **core AC** (armor/shield/natural/size/Dex-to-armor cap), **initiative & save totals**, **grapple total**, **HP fields**, **currency**, **many item types** (weapon, armor, spell, class, race, feat, feature, buff, attack, faction, consumable, equipment), **character & level-up wizards** with feat prereq parsing, **faction/trade** subsystem, **grid/diagonal settings**, and **multiple SRD compendia**. Sections **1–17** below expand row-by-row; **§20** lists optional non-SRD extensions.

**§1 update:** Character fundamentals now include **effective abilities** (damage/drain/aging, fractional bonus, polymorph replacements), **Con→HP adjustment** on edit, **negative levels** on saves/skills/init/grapple, **land speed** (armor penalty, encumbrance, difficult terrain), **default reach by size** + override, **identity & senses** fields, **temp HP source rows**, **multiclass XP reminder** + favored-class fields. Manual checklist: [`CHARACTER-FUNDAMENTALS-TEST-CHECKLIST.md`](./CHARACTER-FUNDAMENTALS-TEST-CHECKLIST.md).

The Combat tab **Rules** list (`module/helpers/phb-rest.mjs`) rolls the remaining PHB and DMG procedures: skill DCs, maneuvers, healing, poison, hazards, diplomacy, crafting, psionics, and encounter math. Sheet math also applies ability burn, gestalt BAB and saves, racial Hit Dice, typed skill bonuses, monk unarmed damage, flurry, underwater attacks, flat-footed Dex loss, fortification, energy vulnerability, forbidden schools, and the power-point pool. Square-by-square threatened area, and the books in §20, are still not automated.

---

## 1. Character fundamentals

| Topic | Status | Notes / gaps |
|-------|--------|----------------|
| Ability scores & modifiers | **Present** | Effective score → `mod = floor((effective−10)/2)`; **`effective`** accounts for polymorph base, damage/drain/aging, optional fractional **bonus** (`actor.mjs`, ability-adjustments partial) |
| Ability damage / drain / burn | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Hit points (current / max / temp / nonlethal) | **Present** | Sheet inputs; **`tempSources`** array + derived **`tempSourcesSum`**; **dying**, stabilization, death threshold, massive damage — not automated |
| Constitution changes & HP | **Present** | On **character** actors, client that edits **Constitution `value`** adjusts **`hp.max`** and **`hp.value`** by **ΔCon modifier × total level** (PHB-style); see `actor-character-mechanics.mjs` |
| Level (total) | **Present** | Sum of **class** item levels (`actor.mjs`) |
| Experience points & next level | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Favored class / multiclass XP penalty | **Present** | Favored class is excluded once. Each other class more than one level behind the highest is −20%. The Identity hint shows the percent |
| Race (SRD quick picks) | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Size category | **Present** | `traits.size`; feeds AC size mod & grapple; default **reach** table in **`CTSDND35.sizeReachFt`** (`config.mjs`) |
| Reach by size / creature | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Speed — land / fly / swim / climb / burrow | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Alignment | **Present** | Stored; used in **feat** prereq checks |
| Deity, gender, biography, notes | **Present** | Narrative fields |
| Age, height, weight, eyes/hair | **Present** | **`system.details`**: `age`, `height`, `weight`, `eyes`, `hair` — Identity partial (+ NPC bio partial) |
| Languages | **Present** | **`details.languages`** text + **`details.literate`** (Yes/No); no structured tag list |
| Vision & senses (darkvision, low-light, etc.) | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Level drain / negative levels | **Present** | **`attributes.negativeLevels`** subtracts from **saves**, **skills**, **init**, **grapple**; **`bab.attackPenalty`** for display; **effective caster level / SLAs / HD-based abilities** — not reduced automatically |
| Creature type / subtype (PC) | **Present** | **`details.creatureType`**, **`details.creatureSubtype`** (free text); monsters still often manual stat blocks |
| Humanoid subtype / racial traits as flags | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Polymorph / wild shape “replacement stats” mode | **Present** | **`system.traits.polymorph`**: enable + replacement **Str/Dex/Con**; damage/drain/aging still apply on top |
| Aging bonuses & penalties (optional v3.5 tables) | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Fractional ability scores (effects that grant +2 vs +1) | **Present** | **`abilities.<key>.bonus`** with fractional **`step`** on sheet; effective uses **`floor(value + bonus − penalties)`** |
| Temporary HP sources (spells, rage) separate tracking | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |

**Testing §1:** step-by-step checklist → [`CHARACTER-FUNDAMENTALS-TEST-CHECKLIST.md`](./CHARACTER-FUNDAMENTALS-TEST-CHECKLIST.md).

---

## 2. Classes, leveling, multiclass, prestige

| Topic | Status | Notes / gaps |
|-------|--------|----------------|
| Class as **Item** | **Present** | Levels, BAB progression type, tied to wizards |
| BAB derived from all class levels | **Present** | Tables in `config.mjs`; summed in `actor.mjs` |
| Fractional BAB / saves (optional variant) | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Base saves from class + level | **Present** | Class items’ high/low saves (core classes use SRD lines while the compendium stub is untouched) sum into Fort/Ref/Will; misc bonus stays manual (`actor.mjs`) |
| Hit dice / HP at level 1 & beyond | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Max HP vs rolled HP history | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Skill points per level | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Human bonus skill point at 1st | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Max ranks (class / cross-class) | **Present** | `getSkillRankCap` |
| Class skill flags on sheet | **Present** | Per-skill class checkbox |
| Cross-class max half-ranks ceiling | **Present** | Via cap formula; sheet editing can still error |
| Starting wealth / gear at level 1 | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Wealth-by-level for higher starts | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Level drain affecting effective level for abilities | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Prestige classes | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Class feature grants by level (automated) | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Gestalt | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| NPC class vs PC class | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Monster racial HD vs class levels | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Spellcasting progression metadata | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Multiclass spellcaster “combined slots” (UM rules) | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Familiar / animal companion / mount as linked actors | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Rebuilding / PHB replacement levels | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |

---

## 3. Skills

| Topic | Status | Notes / gaps |
|-------|--------|----------------|
| Full SRD skill list | **Present** | `CTSDND35.skills` |
| Trained-only skills | **Present** | `untrained` flag in config; enforcement on roll — **soft** |
| “Rank 0” trained-only retry behavior | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Ranks, ability mod, misc, **total** | **Present** | `actor.mjs` `_prepareSkills` |
| Circumstance / competence / insight bonuses (typed) | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Class skill vs cross-class **cost** | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Skill synergies | **Present** | Five ranks in the source skill add +2 on the PHB pairs (Bluff to Diplomacy / Intimidate / Sleight of Hand, Tumble to Balance and Jump, and the other core pairs). The bonus is inside the skill total; hover the total for the amount |
| Armor check penalty on skills | **Present** | Equipped armor ACP is subtracted in `_prepareSkills`. |
| Double armor penalty (e.g. Swim) | **Present** | Swim uses twice the armor check penalty. |
| Fatigue / encumbrance to skills | **Present** | Fatigue and exhaustion change Str and Dex. Encumbrance is inside the armor check penalty. |
| Tools & masterwork tools | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Skill tricks / substitution (non-SRD supplements) | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Taking 10 / Taking 20 | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Distractions forbidding take 10 | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Aid another | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Opposed checks (Bluff vs Sense Motive, etc.) | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Retry rules / special durations | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Individual skill APIs (e.g. Craft income, Decipher page/week) | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Appraise tied to **trade** pricing | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Knowledge checks vs DC tables | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Survival (track, endure elements, forecast) DC scaffolding | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Use Magic Device (emulate ability score / race / alignment) | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Speak Language / literacy (if using house list) | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Use Rope, Swim with armor | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Jump runs off moved speed (restriction) | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Balance / Tumble vs narrow surface DCs | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |

---

## 4. Feats, traits, class features

| Topic | Status | Notes / gaps |
|-------|--------|----------------|
| **Feat** items & list | **Present** | Character sheet list |
| Prerequisite parser | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Prereq: spellcasting / caster level / specific spells known | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Prereq: race type (e.g. Undead) / creature subtype | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Fighter bonus feat slots / scaling | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Wizard bonus metamagic / item creation lists | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Stacking rules (same-source bonuses) | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Metamagic feats | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Item creation feats | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Leadership / cohort / followers | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Passive numeric bonuses from feats | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| **Feature** items (class features) | **Present** | Stored; mechanics manual |
| **Race** items | **Present** | Stored; mechanics manual |
| Alternate racial traits / subraces | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Regional / background feats (if used) | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Flaws / traits (UA-style, optional) | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |

---

## 5. Combat — attacks & damage

| Topic | Status | Notes / gaps |
|-------|--------|----------------|
| **Weapon** / **attack** items | **Present** | Types exist |
| Melee attack bonus decomposition | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Str vs Dex on melee (finesse, rapier exception) | **Present** | Weapon Finesse and the finesse list use Dex when it is higher. |
| Off-hand light weapon penalties | **Present** | Off-hand weapons use the light and heavy two-weapon table. |
| Ranged attacks | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Range increments & cumulative −2 | **Present** | Weapon details field. One increment is no penalty |
| Projectile vs thrown weapon rules | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Iterative attacks (BAB −5, −10, …) | **Present** | Weapon and attack items roll each iterative; off-hand and secondary natural attacks stay a single strike (`combat-rules.mjs`) |
| Natural weapons & secondary attacks | **Present** | Natural weapons are one attack. Secondary natural attacks are −5 and half Strength. |
| Primary / secondary natural attack BAB offset | **Present** | The Secondary natural flag on the weapon applies −5. |
| Unarmed strike & monk progression | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Touch attacks / ranged touch | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Holding charge / touch spell through weapon | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Critical threat / confirmation / multiplier | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Keen / Improved Critical stacking limits | **Present** | Keen on the weapon (or the word Keen in the name) and Improved Critical whose Choice matches the weapon each double the threat width, and they stack (20 becomes 19, then 17) |
| Damage rolls & chat cards | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Damage types (B/S/P) & energy types | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Half damage on successful save (spells) | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Precision damage (sneak attack, etc.) | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Critical immunity / fortification interaction | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Nonlethal damage | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Splash weapons (alchemy, etc.) | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Weapon size / inappropriate size | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Reach weapon “dead zone” (10 ft. no adjacent) | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Two-weapon fighting penalties | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Manyshot / Rapid Shot / Flurry linkage | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Power Attack / Combat Expertise sliders | **Present** | Combat tab values, capped by BAB and the feat |
| Charge attack bonus / AC penalty | **Present** | Posture select on the Combat tab |
| Fighting defensively / total defense modifiers | **Present** | Posture select |

---

## 6. Combat — AC, saves, resistances

| Topic | Status | Notes / gaps |
|-------|--------|----------------|
| AC (normal) | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Touch AC | **Present** | Derived line |
| Flat-footed AC | **Present** | Derived line |
| Lose Dex to AC (when applicable) | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Dodge, deflection, insight, sacred, profane, luck, misc AC | **Present** | Typed AC buckets reset each pass and accept buffs and Active Effects. |
| Max Dex bonus from armor | **Present** | Lowest equipped armor `maxDex` caps Dex to AC |
| Multiple armor pieces equipped edge case | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Shield spell / force effects | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Saving throws (Fort / Ref / Will total) | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Saving throw bonuses by source | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Circumstance bonuses on saves (good/neutral/evil aura, etc.) | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Damage reduction (DR) | **Present** | The attack chat subtracts the highest DR row the weapon does not bypass. Rows do not stack |
| DR bypass materials / alignment / magic | **Present** | Weapon enhancement or the Magic flag, Material, and Alignment are matched against the bypass text. A dash bypass is never skipped |
| Energy resistance / immunity | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Vulnerability / healing amp for energy | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Spell resistance (SR) | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Hardness & object HP | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Attacking objects / breaking doors | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Miss chance (concealment / blur / displacement) | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Incorporeal 50% miss vs nonmagical | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Fortification (crit immunity %) | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |

---

## 7. Combat — actions, movement, positioning

| Topic | Status | Notes / gaps |
|-------|--------|----------------|
| Initiative order | **Present** | Foundry combat + sheet initiative roll |
| Initiative modifiers (feat, familiar, etc.) | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Flat-footed until first turn | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Turn structure (standard / move / swift / immediate / full-round) | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Full-round action lock (no 5-ft step) | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Delay / ready | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Charge, withdraw, run, tumble through threatened squares | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Run ×4 speed & straight-line limit | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| 5-foot step | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Difficult terrain (half speed) | **Present** | The terrain select halves land speed. |
| Hampered movement (climb/swim/balance) | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Grappling rules (initiate, hold, pin, damage, escape) | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Grapple size modifier table | **Present** | Size is included in the grapple modifier. |
| Trip, bull rush, overrun, disarm, sunder, feint | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Improved Trip / Stand from prone interactions | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Mounted combat | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Mounted archery / charge / leap | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Reach weapons & threatened squares | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Flanking (+2 melee) | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Soft cover from allies (Precise Shot gate) | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Attacks of opportunity | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Provoking: casting in threat, ranged in threat, movement | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Tumble through threatened (vs AoO) | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Cover / concealment modifiers | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Higher ground, squeezing | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Teleport / dimension door & AoOs | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Underwater combat penalties | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |

---

## 8. Conditions, healing, death

| Topic | Status | Notes / gaps |
|-------|--------|----------------|
| **Buff** item type | **Present** | Exists; **duration / combat-round** automation thin |
| SRD condition catalog (applied effects) | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Foundry **Active Effects** driving mods | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Condition duration (rounds / minutes / Dismissible) | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Fatigued / exhausted track | **Present** | Status checkboxes apply the Str, Dex, and speed penalties. Exhausted replaces fatigued. |
| Shaken / frightened / panicked | **Present** | Fear is −2 and the conditions do not stack. |
| Confused / fascinated | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Nauseated / sickened | **Present** | Sickened is −2. Nauseated blocks attacks. |
| Stunned / dazed / helpless | **Present** | Dazed and stunned block attacks. Helpless uses Dex −5. |
| Paralyzed / petrified | **Present** | Treated as helpless. |
| Sleeping / unconscious | **Present** | Unconscious is helpless. |
| Prone modifiers (melee vs ranged) | **Present** | Prone is −4 AC versus melee and +4 versus ranged. |
| Invisible / blind | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Deafened / silence interaction | **Present** | Deafened adds verbal spell failure unless the spell is Silent. |
| Poison & disease (frequency, DC track) | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Ability damage / drain over time | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Energy drain stacking | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Stable / dying / dead | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Coup de grâce auto-hit / crit | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Massive damage Fort save | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Natural healing / long-term care | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Fast healing / regeneration | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Raise dead / resurrection / restoration (spell effects) | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Construct / undead immunity bundles | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |

---

## 9. Equipment & inventory

| Topic | Status | Notes / gaps |
|-------|--------|----------------|
| Weapons, armor, shields, goods | **Present** | Item types + sheets |
| Equipped flag (armor/shield) | **Present** | Feeds AC |
| Multiple weapon equip / main-hand off-hand | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Weapon stats (damage, crit, type, reach flags in data?) | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Armor stats (bonus, max Dex, ACP, arcane spell failure, speed) | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Masterwork (+1 nonmagical) | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Magic enhancement (+1 armor / weapon) | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Enhancement bonus caps & stacking with MW | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Ghost touch / holy / axiomatic weapon props vs DR | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Material (cold iron, silver, adamantine) | **Present** | Weapon material is matched against damage reduction. |
| Adamantine bypass hardness | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Weapon sizing & handedness | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Double weapons / two-bladed swords | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Ammunition & consumption | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Thrown weapon returning / replenishing | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Charges / per-day item uses | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Staff / wand / potion identification | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Weight & encumbrance | **Present** | Carried weight and the load band are on the Combat tab. |
| Load limits by Strength | **Present** | Carrying capacity comes from Strength. |
| Medium / heavy encumbrance penalties | **Present** | Medium and heavy load reduce speed and add the check penalty. |
| Body slots (ring ×2, head, eyes, …) | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Slotless / combining rules | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Drawing / sheathing / dropping | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Breaking / sundering gear | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Inventory sort / container nesting | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |

---

## 10. Spells & divine casting

| Topic | Status | Notes / gaps |
|-------|--------|----------------|
| **Spell** items & per-level lists | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Spell preparation (Vancian) | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Spellbook / known spells list per class | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Spontaneous casting (known spells / slots) | **Present** | Casting a spontaneous spell spends the metamagic-adjusted slot. |
| Spell slots per level | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Bonus spells from high ability | **Present** | PHB Table 1–1 added only for spell levels the class can already cast (`bonusSpellsForScore`) |
| Domain spell slots | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Specialist wizard forbidden schools | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Caster level (global per class) | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Penetration vs SR (Spell Penetration feats) | **Present** | The spell card rolls 1d20 + caster level + Spell Penetration. |
| Spell DC (10 + level + ability) | **Present** | Shown per spell and per slot; click a spell to post DC and an arcane failure check |
| Heightened / empowered metamagic adjusted DC & level | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Spell resistance check | **Present** | Casting a spell posts the spell resistance check. |
| Concentration (DC = 10 + damage + spell level, etc.) | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Defensive casting option | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Components V / S / M / F / DF / XP | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Arcane spell failure chance | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Divine focus / inexpensive material defaults | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Somatic components in grapple | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Counterspells | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Dispel magic / greater dispel checks | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Buff stacking (same spell multiple times) | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Persistent / metamagic rods | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Swift / immediate action spells | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Summon lists & augmented summons | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Antimagic field / dead magic areas | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Domains & domain spells | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Turn / rebuke undead | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Turning damage / destruction thresholds | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Divine metamagic / divine feats | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Divine spell morality (cleric alignment) | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Paladin / ranger spell lists by level | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |

---

## 11. Psionics (SRD Expanded — if used)

| Topic | Status | Notes / gaps |
|-------|--------|----------------|
| Power **Item** compendium | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Power points (reserve / spend / regain) | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Manifester level / discipline | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Display / augment | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Power resistance vs powers | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Psi-like abilities ( monsters ) | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Dorjes / power stones / cognizance crystals | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Wild surge / enervation (class variants) | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |

---

## 12. Monsters & NPCs

| Topic | Status | Notes / gaps |
|-------|--------|----------------|
| **NPC** actor sheet | **Present** | Includes trade / factions tab |
| Challenge Rating field | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Encounter EL / mixed CR calculator | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Monster ability scores & skills | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Monster type / subtype traits (construct, undead, swarm…) | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Special attacks & qualities | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Breath weapon DC (10 + ½ HD + Con) automation | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Spell-like abilities per day | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Treasure type / encounter loot tables | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Advancement by HD / templates | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Half-celestial / half-fiend / lich template toggles | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Summoned creatures / generic tokens | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Mob rules / swarm math | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Bestiary compendium | **Present** | `srd-monsters` pack |

---

## 13. Environment & hazards

| Topic | Status | Notes / gaps |
|-------|--------|----------------|
| Falling damage | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Falling object damage | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Suffocation / drowning | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Fire / cold environmental damage | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Lava / acid immersion | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Starvation / thirst / forced Con damage | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Extreme heat / cold (Fort cycles) | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Light sources vs darkvision radius | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Magical darkness vs mundane light | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Weather & forced saves | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Wind effects on ranged attacks / flight | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Traps (Search / Disable / Reflex) | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Haunts / encounters tied to scenes | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |

---

## 14. Social play & downtime

| Topic | Status | Notes / gaps |
|-------|--------|----------------|
| Diplomacy / Gather Information DC scaffolding | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| NPC attitude track (hostile → helpful) | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Sense Motive vs Bluff | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Intimidate / demoralize | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Perform / bardic performance hooks | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Urban encounters / reputation | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Research / knowledge library downtime | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Training for new languages or ranks (time + gold) | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Spell research / item crafting downtime | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |

---

## 15. Economy & CTS-specific systems

| Topic | Status | Notes / gaps |
|-------|--------|----------------|
| Currency (cp/sp/gp/pp) | **Present** | Actor field |
| Selling gear (half base price, masterwork, magic) | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Trade goods / gems / art objects | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Loans / letters of credit / banks | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Craft / Profession income | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Item crafting cost & time (feats + spells) | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Treasure allocation | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Party loot sheet / merchant actor | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| **Faction** items & Gear % stacking | **Present** | Trade buyer modifiers |
| Race-based buyer/seller trade % | **Present** | NPC sheet + `computeGearPricePercentTotal` |
| Item pricing helpers | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Cost adjustment by settlement size (optional house rule) | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |

---

## 16. Canvas, tokens & Foundry integration

| Topic | Status | Notes / gaps |
|-------|--------|----------------|
| Token ↔ actor link | **Present** | Foundry default |
| Vision modes on token | **Present** | Foundry; not driven by 3.5 sense aggregation |
| Darkvision / low-light radius from actor | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Multi-token linked summons | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Elevation / flight bands | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Grid diagonal policy (3.5 style) | **Present** | System setting enforces 5-10-5 option |
| Enforce 5-ft square scale | **Present** | World setting option in system init |
| Template placement / areas | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Measured templates & spell areas | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Walls / doors blocking LoS & movement | **Present** | Foundry walls; system does not validate 3.5 cover rules |
| Ruler & waypoints (movement audit) | **Present** | Foundry core |

---

## 17. UX, macros & authoring (benchmark vs D35E 3.0)

Capabilities described in [D35E 3.0.0](https://gitlab.com/dragonshorn/D35E/-/releases/3.0.0) as **aspirational** targets for any deep 3.5 Foundry system—not a CTS requirement list.

| Capability | CTS status |
|------------|------------|
| Threatened-area overlay & reach-aware melee | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Automatic flanking / threat detection at attack time | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Formula builder / `@variable` picker on item fields | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Equipment slot enforcement + bonus slots from effects | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Advanced ammunition (no consume / ammo damage riders) | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| NPC treasure blocks & treasure generator hooks | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Optional heavy combat tracker (actions, AoOs, buff ticks) | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Encounter / initiative extensions beyond core Foundry | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |
| Compendium drag-drop onto sheet | **Present** | Foundry + your item types |
| System hooks documented for macro authors | **Present** | Supported on the sheet, the attack or spell card, or the Combat tab Rules list. |

---

## 18. Suggested roadmap (ordered)

1. **Modifier pipeline** — One path: equipped items + buffs + conditions → AC components, saves, skills, speed, AB, damage (Active Effects or custom Changes).
2. **Armor & encumbrance** — ACP, ASF, speed reduction, weight, loads; skill penalties.
3. **Combat core** — Crit pipeline, DR/resist, energy types, iterative attacks (even if manual toggles first).
4. **Spellcasting** — Slots, DC, CL, concentration helper, ASF application.
5. **Special actions** — AoO counter, flanking flag, reach field on weapon/token (automation can follow).
6. **Canvas polish** — Threat overlays last (depends on reliable reach & disposition).
7. **Conditions & healing** — Active Effects or buff driving stunned/prone/etc.; dying/stable automation (even soft prompts).
8. **Monster QoL** — Treasure fields, SLAs counters, type tags for filtering (before full trait engine).
9. **Authoring** — Formula docs / in-sheet links for macro users until a formula builder exists.

---

## 19. Maintaining this document

- After shipping a feature, change **Missing** → **Partial** → **Present** and add the owning path (`module/…`, `templates/…`).
- Add a **Non-goals** subsection if you intentionally stay theatre-of-the-mind for some rows.

---

## 20. Appendix — optional / non-SRD scope

These are **common 3.5-era extensions**; track only if you officially support them.

| Topic | Default stance |
|-------|----------------|
| Epic levels / epic feats | **Out of scope** unless added as packs + progression |
| Incarnum (Magic of Incarnum) | **Out of scope** |
| Tome of Battle (martial adepts) | **Out of scope** |
| Tome of Magic (binders/shadow/truename) | **Out of scope** |
| Setting-specific classes (Eberron, Faerûn) | **Pack content** only |
| Unearthed Arcana variants (gestalt already flagged) | **Case-by-case** |

---

*CTS-DND-35 mechanics audit (expanded). Reference benchmark: [D35E 3.0.0 release notes](https://gitlab.com/dragonshorn/D35E/-/releases/3.0.0).*
