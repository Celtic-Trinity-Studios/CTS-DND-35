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
| Ability damage / drain / burn | **Partial** | Per-ability **damage**, **drain**, **aging** fields reduce effective score; **burn** not a separate column (treat as drain or misc if needed) |
| Hit points (current / max / temp / nonlethal) | **Present** | Sheet inputs; **`tempSources`** array + derived **`tempSourcesSum`**; **dying**, stabilization, death threshold, massive damage — not automated |
| Constitution changes & HP | **Present** | On **character** actors, client that edits **Constitution `value`** adjusts **`hp.max`** and **`hp.value`** by **ΔCon modifier × total level** (PHB-style); see `actor-character-mechanics.mjs` |
| Level (total) | **Present** | Sum of **class** item levels (`actor.mjs`) |
| Experience points & next level | **Partial** | **`details.level.xp`** on the sheet and derived **`details.level.xpNext`** from the PHB table (after 20, +20,000). Awards and buyoff rules stay manual. NPC **`details.cr`** derives **`details.xpAward`** from the DMG table |
| Favored class / multiclass XP penalty | **Present** | Favored class is excluded once. Each other class more than one level behind the highest is −20%. The Identity hint shows the percent |
| Race (SRD quick picks) | **Partial** | `config.mjs` racial presets + **race** items; **traits not auto-applied** to speed/abilities/skills centrally |
| Size category | **Present** | `traits.size`; feeds AC size mod & grapple; default **reach** table in **`CTSDND35.sizeReachFt`** (`config.mjs`) |
| Reach by size / creature | **Partial** | Derived **`traits.reachFt`** (+ **`traits.reachOverride`**) on actor/sheet header; **token reach / grid enforcement** still manual in Foundry |
| Speed — land / fly / swim / climb / burrow | **Partial** | Land, and fly/swim/climb/burrow when the base is above 0, take the worse of the armor speed penalty and the encumbrance speed. Difficult terrain still halves land only. A base of 0 stays 0 |
| Alignment | **Present** | Stored; used in **feat** prereq checks |
| Deity, gender, biography, notes | **Present** | Narrative fields |
| Age, height, weight, eyes/hair | **Present** | **`system.details`**: `age`, `height`, `weight`, `eyes`, `hair` — Identity partial (+ NPC bio partial) |
| Languages | **Present** | **`details.languages`** text + **`details.literate`** (Yes/No); no structured tag list |
| Vision & senses (darkvision, low-light, etc.) | **Partial** | **`system.traits.senses`** (ranges + low-light/scent flags + notes) on sheet; **not** pushed to token vision / automation (contrast D35E) |
| Level drain / negative levels | **Present** | **`attributes.negativeLevels`** subtracts from **saves**, **skills**, **init**, **grapple**; **`bab.attackPenalty`** for display; **effective caster level / SLAs / HD-based abilities** — not reduced automatically |
| Creature type / subtype (PC) | **Present** | **`details.creatureType`**, **`details.creatureSubtype`** (free text); monsters still often manual stat blocks |
| Humanoid subtype / racial traits as flags | **Partial** | **`details.humanoidSubtype`** text; **no** feat/prerequisite wiring from subtype flags |
| Polymorph / wild shape “replacement stats” mode | **Present** | **`system.traits.polymorph`**: enable + replacement **Str/Dex/Con**; damage/drain/aging still apply on top |
| Aging bonuses & penalties (optional v3.5 tables) | **Partial** | Per-ability **`aging`** still subtracts when the table is off. Identity **`applyAgingTable`** plus **`ageCategory`** (middle / old / venerable) applies the PHB table instead. **`applyRacialAdjustments`** adds the core race row when the Race name matches. Both default off so scores that already include race or age are not doubled |
| Fractional ability scores (effects that grant +2 vs +1) | **Present** | **`abilities.<key>.bonus`** with fractional **`step`** on sheet; effective uses **`floor(value + bonus − penalties)`** |
| Temporary HP sources (spells, rage) separate tracking | **Partial** | **`hp.tempSources`** rows (add/remove in **`actor-sheet.mjs`**) + **`tempSourcesSum`**; **manual `hp.temp`** still separate; **no** auto-expire by source or round tracking |

**Testing §1:** step-by-step checklist → [`CHARACTER-FUNDAMENTALS-TEST-CHECKLIST.md`](./CHARACTER-FUNDAMENTALS-TEST-CHECKLIST.md).

---

## 2. Classes, leveling, multiclass, prestige

| Topic | Status | Notes / gaps |
|-------|--------|----------------|
| Class as **Item** | **Present** | Levels, BAB progression type, tied to wizards |
| BAB derived from all class levels | **Present** | Tables in `config.mjs`; summed in `actor.mjs` |
| Fractional BAB / saves (optional variant) | **Missing** | Standard integer BAB/saves only |
| Base saves from class + level | **Present** | Class items’ high/low saves (core classes use SRD lines while the compendium stub is untouched) sum into Fort/Ref/Will; misc bonus stays manual (`actor.mjs`) |
| Hit dice / HP at level 1 & beyond | **Partial** | Level-up wizard supports **fixed / roll / manual** style flow; full HD averaging rules table-side |
| Max HP vs rolled HP history | **Partial** | Rules panel: Hit points gained this level. |
| Skill points per level | **Partial** | Wizard + `getSkillRankCap`; multiclass **class skill lists** merged from packs |
| Human bonus skill point at 1st | **Partial** | Wizard narrative; not enforced as +4 vs +1 rule universally |
| Max ranks (class / cross-class) | **Present** | `getSkillRankCap` |
| Class skill flags on sheet | **Present** | Per-skill class checkbox |
| Cross-class max half-ranks ceiling | **Present** | Via cap formula; sheet editing can still error |
| Starting wealth / gear at level 1 | **Partial** | Rules panel: Starting gold reminder. |
| Wealth-by-level for higher starts | **Partial** | Rules panel: Wealth by level. |
| Level drain affecting effective level for abilities | **Partial** | §1 **negative levels** penalize saves/skills/init/grapple/BAB display; **caster level / SLAs / features keyed to HD or level** — still manual |
| Prestige classes | **Partial** | Same **class** item; **entry requirements** beyond feats not systematically enforced |
| Class feature grants by level (automated) | **Partial** | Identity lists grants from each class item’s feature table through the current level. The sheet does not create feature items |
| Gestalt | **Partial** | `enableGestalt` setting; depth depends on wizard |
| NPC class vs PC class | **Partial** | Data can exist in packs; no separate NPC-class workflow |
| Monster racial HD vs class levels | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Spellcasting progression metadata | **Partial** | `getSpellcastingProgression` etc. in `progression-rules`; **slot/spells-known execution** thin |
| Multiclass spellcaster “combined slots” (UM rules) | **Missing** | |
| Familiar / animal companion / mount as linked actors | **Partial** | Identity has a linked companion id. It does not spawn the actor. |
| Rebuilding / PHB replacement levels | **Missing** | |

---

## 3. Skills

| Topic | Status | Notes / gaps |
|-------|--------|----------------|
| Full SRD skill list | **Present** | `CTSDND35.skills` |
| Trained-only skills | **Present** | `untrained` flag in config; enforcement on roll — **soft** |
| “Rank 0” trained-only retry behavior | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Ranks, ability mod, misc, **total** | **Present** | `actor.mjs` `_prepareSkills` |
| Circumstance / competence / insight bonuses (typed) | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Class skill vs cross-class **cost** | **Partial** | `getSkillPointCost` exists; wizard applies; **sheet direct-edit** can desync |
| Skill synergies | **Present** | Five ranks in the source skill add +2 on the PHB pairs (Bluff to Diplomacy / Intimidate / Sleight of Hand, Tumble to Balance and Jump, and the other core pairs). The bonus is inside the skill total; hover the total for the amount |
| Armor check penalty on skills | **Present** | Equipped armor ACP is subtracted in `_prepareSkills`. |
| Double armor penalty (e.g. Swim) | **Present** | Swim uses twice the armor check penalty. |
| Fatigue / encumbrance to skills | **Present** | Fatigue and exhaustion change Str and Dex. Encumbrance is inside the armor check penalty. |
| Tools & masterwork tools | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Skill tricks / substitution (non-SRD supplements) | **Missing** | Out of scope unless you add packs |
| Taking 10 / Taking 20 | **Partial** | Each skill stores **`take10`** and **`take20`** (10 or 20 plus the modifier). Distractions that forbid taking 10 are not detected |
| Distractions forbidding take 10 | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Aid another | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Opposed checks (Bluff vs Sense Motive, etc.) | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Retry rules / special durations | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Individual skill APIs (e.g. Craft income, Decipher page/week) | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Appraise tied to **trade** pricing | **Partial** | `trade-modifiers` exists; **skill DC** for values not integrated |
| Knowledge checks vs DC tables | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Survival (track, endure elements, forecast) DC scaffolding | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Use Magic Device (emulate ability score / race / alignment) | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Speak Language / literacy (if using house list) | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Use Rope, Swim with armor | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Jump runs off moved speed (restriction) | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Balance / Tumble vs narrow surface DCs | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |

---

## 4. Feats, traits, class features

| Topic | Status | Notes / gaps |
|-------|--------|----------------|
| **Feat** items & list | **Present** | Character sheet list |
| Prerequisite parser | **Partial** | `evaluateFeatPrerequisites`: abilities, BAB, level, alignment axes, feat names, **some** skills/race/features |
| Prereq: spellcasting / caster level / specific spells known | **Missing** | Parser gaps |
| Prereq: race type (e.g. Undead) / creature subtype | **Missing** | |
| Fighter bonus feat slots / scaling | **Partial** | Wizard tracks selections; **no** global “feat slot budget” vs sources |
| Wizard bonus metamagic / item creation lists | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Stacking rules (same-source bonuses) | **Missing** | |
| Metamagic feats | **Missing** | No heightening workflow tied to spells |
| Item creation feats | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Leadership / cohort / followers | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Passive numeric bonuses from feats | **Partial** | Named feats apply on their own (initiative, saves, Dodge, Toughness note, Combat Casting, finesse weapons, spell penetration). Weapon Focus / Specialization / Spell Focus need the feat Choice field (`table-combat.mjs`) |
| **Feature** items (class features) | **Present** | Stored; mechanics manual |
| **Race** items | **Present** | Stored; mechanics manual |
| Alternate racial traits / subraces | **Partial** | Pack content only |
| Regional / background feats (if used) | **Missing** | Data-only via packs at best |
| Flaws / traits (UA-style, optional) | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |

---

## 5. Combat — attacks & damage

| Topic | Status | Notes / gaps |
|-------|--------|----------------|
| **Weapon** / **attack** items | **Present** | Types exist |
| Melee attack bonus decomposition | **Partial** | Not one pipeline (BAB + Str/Dex + size + enhancement + morale + luck + …) |
| Str vs Dex on melee (finesse, rapier exception) | **Present** | Weapon Finesse and the finesse list use Dex when it is higher. |
| Off-hand light weapon penalties | **Present** | Off-hand weapons use the light and heavy two-weapon table. |
| Ranged attacks | **Partial** | Weapon **`rangeIncrements`** subtracts 2 per increment after the first. Cover on the target is still a Combat-tab select |
| Range increments & cumulative −2 | **Present** | Weapon details field. One increment is no penalty |
| Projectile vs thrown weapon rules | **Partial** | Thrown weapons add Strength to damage. Projectiles do not. |
| Iterative attacks (BAB −5, −10, …) | **Present** | Weapon and attack items roll each iterative; off-hand and secondary natural attacks stay a single strike (`combat-rules.mjs`) |
| Natural weapons & secondary attacks | **Present** | Natural weapons are one attack. Secondary natural attacks are −5 and half Strength. |
| Primary / secondary natural attack BAB offset | **Present** | The Secondary natural flag on the weapon applies −5. |
| Unarmed strike & monk progression | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Touch attacks / ranged touch | **Partial** | AC touch computed; **attack mode** not distinguished in automation |
| Holding charge / touch spell through weapon | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Critical threat / confirmation / multiplier | **Partial** | A natural roll in the widened threat range adds a confirmation roll and shows the multiplier. Critical immunity and fortification are not applied |
| Keen / Improved Critical stacking limits | **Present** | Keen on the weapon (or the word Keen in the name) and Improved Critical whose Choice matches the weapon each double the threat width, and they stack (20 becomes 19, then 17) |
| Damage rolls & chat cards | **Partial** | Basic `Item.roll()` chat output |
| Damage types (B/S/P) & energy types | **Partial** | Schema varies by item; **DR interaction** missing |
| Half damage on successful save (spells) | **Partial** | Spell **`save.half`**, or “half damage” in the description, notes it on the spell card. The sheet does not roll spell damage |
| Precision damage (sneak attack, etc.) | **Partial** | Combat-tab Sneak attack adds rogue dice (`ceil(level/2)`) to the damage formula. Ranged sneak attack also needs Point blank. Other precision damage is not included |
| Critical immunity / fortification interaction | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Nonlethal damage | **Partial** | HP nonlethal field remains. A weapon **Nonlethal** flag labels the damage line. The roll does not move that number into the HP field |
| Splash weapons (alchemy, etc.) | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Weapon size / inappropriate size | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Reach weapon “dead zone” (10 ft. no adjacent) | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Two-weapon fighting penalties | **Partial** | An off-hand weapon applies the light/heavy penalty table, including Two-Weapon Fighting and extra off-hand attacks from Improved and Greater |
| Manyshot / Rapid Shot / Flurry linkage | **Partial** | Rapid Shot adds the extra attack at −2. Manyshot (feat plus Combat-tab toggle) notes that extra arrows use the same attack roll. Flurry of blows is not built |
| Power Attack / Combat Expertise sliders | **Present** | Combat tab values, capped by BAB and the feat |
| Charge attack bonus / AC penalty | **Present** | Posture select on the Combat tab |
| Fighting defensively / total defense modifiers | **Present** | Posture select |

---

## 6. Combat — AC, saves, resistances

| Topic | Status | Notes / gaps |
|-------|--------|----------------|
| AC (normal) | **Partial** | 10 + armor + shield + capped Dex + size + natural |
| Touch AC | **Present** | Derived line |
| Flat-footed AC | **Present** | Derived line |
| Lose Dex to AC (when applicable) | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Dodge, deflection, insight, sacred, profane, luck, misc AC | **Present** | Typed AC buckets reset each pass and accept buffs and Active Effects. |
| Max Dex bonus from armor | **Present** | Lowest equipped armor `maxDex` caps Dex to AC |
| Multiple armor pieces equipped edge case | **Partial** | Equipped armor still sums. Equipment and armor have a slot field. Identity lists slots worn past the cap (rings allow two). It does not stop the extra item |
| Shield spell / force effects | **Missing** | |
| Saving throws (Fort / Ref / Will total) | **Partial** | Base + ability + misc; base should tie to classes |
| Saving throw bonuses by source | **Missing** | No typed stacking |
| Circumstance bonuses on saves (good/neutral/evil aura, etc.) | **Missing** | |
| Damage reduction (DR) | **Present** | The attack chat subtracts the highest DR row the weapon does not bypass. Rows do not stack |
| DR bypass materials / alignment / magic | **Present** | Weapon enhancement or the Magic flag, Material, and Alignment are matched against the bypass text. A dash bypass is never skipped |
| Energy resistance / immunity | **Partial** | Fire, cold, acid, electricity, and sonic resistance or immunity on the Combat tab adjust matching weapon damage in chat |
| Vulnerability / healing amp for energy | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Spell resistance (SR) | **Partial** | Numeric field; **no** caster check workflow |
| Hardness & object HP | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Attacking objects / breaking doors | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Miss chance (concealment / blur / displacement) | **Partial** | Combat-tab concealment percent rolls 1d100 on the attack card. Blur and displacement are not separate effects |
| Incorporeal 50% miss vs nonmagical | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Fortification (crit immunity %) | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |

---

## 7. Combat — actions, movement, positioning

| Topic | Status | Notes / gaps |
|-------|--------|----------------|
| Initiative order | **Present** | Foundry combat + sheet initiative roll |
| Initiative modifiers (feat, familiar, etc.) | **Partial** | Dex + misc init bonus field only |
| Flat-footed until first turn | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Turn structure (standard / move / swift / immediate / full-round) | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Full-round action lock (no 5-ft step) | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Delay / ready | **Missing** | |
| Charge, withdraw, run, tumble through threatened squares | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Run ×4 speed & straight-line limit | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| 5-foot step | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Difficult terrain (half speed) | **Present** | The terrain select halves land speed. |
| Hampered movement (climb/swim/balance) | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Grappling rules (initiate, hold, pin, damage, escape) | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Grapple size modifier table | **Present** | Size is included in the grapple modifier. |
| Trip, bull rush, overrun, disarm, sunder, feint | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Improved Trip / Stand from prone interactions | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Mounted combat | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Mounted archery / charge / leap | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Reach weapons & threatened squares | **Missing** | No geometry (D35E-style overlays absent) |
| Flanking (+2 melee) | **Partial** | Combat tab toggle. The sheet does not detect it from token positions |
| Soft cover from allies (Precise Shot gate) | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Attacks of opportunity | **Partial** | Pool from Dexterity and Combat Reflexes, spend/reset, and a refresh when that creature's turn starts. Provoking movement is not detected |
| Provoking: casting in threat, ranged in threat, movement | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Tumble through threatened (vs AoO) | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Cover / concealment modifiers | **Partial** | Cover on you and cover on the target are Combat tab selects. Concealment percent rolls 1d100 on the attack card |
| Higher ground, squeezing | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Teleport / dimension door & AoOs | **Missing** | |
| Underwater combat penalties | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |

---

## 8. Conditions, healing, death

| Topic | Status | Notes / gaps |
|-------|--------|----------------|
| **Buff** item type | **Present** | Exists; **duration / combat-round** automation thin |
| SRD condition catalog (applied effects) | **Partial** | Status checkboxes apply the common numeric penalties (fear, sickened, fatigue, grappled, helpless, prone AC, slowed, deafened spell failure). Durations and action locks are noted, not enforced |
| Foundry **Active Effects** driving mods | **Partial** | Active Effects add to the keys in `modifier-pipeline.mjs` after each reset. |
| Condition duration (rounds / minutes / Dismissible) | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Fatigued / exhausted track | **Present** | Status checkboxes apply the Str, Dex, and speed penalties. Exhausted replaces fatigued. |
| Shaken / frightened / panicked | **Present** | Fear is −2 and the conditions do not stack. |
| Confused / fascinated | **Partial** | The condition note is on the sheet. The 1d100 confused table is not rolled for you. |
| Nauseated / sickened | **Present** | Sickened is −2. Nauseated blocks attacks. |
| Stunned / dazed / helpless | **Present** | Dazed and stunned block attacks. Helpless uses Dex −5. |
| Paralyzed / petrified | **Present** | Treated as helpless. |
| Sleeping / unconscious | **Present** | Unconscious is helpless. |
| Prone modifiers (melee vs ranged) | **Present** | Prone is −4 AC versus melee and +4 versus ranged. |
| Invisible / blind | **Partial** | Blinded removes the Dex bonus and is −2 AC. Invisible is a 50% miss note. Set concealment to roll it. |
| Deafened / silence interaction | **Present** | Deafened adds verbal spell failure unless the spell is Silent. |
| Poison & disease (frequency, DC track) | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Ability damage / drain over time | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Energy drain stacking | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Stable / dying / dead | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Coup de grâce auto-hit / crit | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Massive damage Fort save | **Partial** | `game.ctsdnd35.massiveDamageDc()` is 15. The sheet does not start the save |
| Natural healing / long-term care | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Fast healing / regeneration | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Raise dead / resurrection / restoration (spell effects) | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Construct / undead immunity bundles | **Partial** | The creature type note lists the immunities. They are not a separate checkbox set. |

---

## 9. Equipment & inventory

| Topic | Status | Notes / gaps |
|-------|--------|----------------|
| Weapons, armor, shields, goods | **Present** | Item types + sheets |
| Equipped flag (armor/shield) | **Present** | Feeds AC |
| Multiple weapon equip / main-hand off-hand | **Missing** | |
| Weapon stats (damage, crit, type, reach flags in data?) | **Partial** | Pack-dependent; not validated |
| Armor stats (bonus, max Dex, ACP, arcane spell failure, speed) | **Partial** | AC bonus & maxDex used; **ACP / ASF / speed penalty** fields if present — **not** wired globally |
| Masterwork (+1 nonmagical) | **Partial** | Pack data possible; **rule** not centralized |
| Magic enhancement (+1 armor / weapon) | **Partial** | Some fields on armor |
| Enhancement bonus caps & stacking with MW | **Missing** | |
| Ghost touch / holy / axiomatic weapon props vs DR | **Missing** | |
| Material (cold iron, silver, adamantine) | **Present** | Weapon material is matched against damage reduction. |
| Adamantine bypass hardness | **Missing** | |
| Weapon sizing & handedness | **Missing** | |
| Double weapons / two-bladed swords | **Missing** | |
| Ammunition & consumption | **Partial** | A weapon can spend 1 quantity when it is rolled. |
| Thrown weapon returning / replenishing | **Missing** | |
| Charges / per-day item uses | **Partial** | Schema possible; no universal UI |
| Staff / wand / potion identification | **Missing** | |
| Weight & encumbrance | **Present** | Carried weight and the load band are on the Combat tab. |
| Load limits by Strength | **Present** | Carrying capacity comes from Strength. |
| Medium / heavy encumbrance penalties | **Present** | Medium and heavy load reduce speed and add the check penalty. |
| Body slots (ring ×2, head, eyes, …) | **Partial** | Identity lists slots worn past the cap. Rings allow two. |
| Slotless / combining rules | **Missing** | |
| Drawing / sheathing / dropping | **Missing** | |
| Breaking / sundering gear | **Missing** | |
| Inventory sort / container nesting | **Partial** | Flat item list; Foundry folders manual |

---

## 10. Spells & divine casting

| Topic | Status | Notes / gaps |
|-------|--------|----------------|
| **Spell** items & per-level lists | **Partial** | Sheet lists by level |
| Spell preparation (Vancian) | **Partial** | Prepared casters track a prepared count per spell and spend one on a cast. Spontaneous casters spend the metamagic-adjusted slot |
| Spellbook / known spells list per class | **Missing** | |
| Spontaneous casting (known spells / slots) | **Present** | Casting a spontaneous spell spends the metamagic-adjusted slot. |
| Spell slots per level | **Partial** | Slots per day from the class progression plus ability bonus spells; Use / restore on the Spells list tracks expended slots |
| Bonus spells from high ability | **Present** | PHB Table 1–1 added only for spell levels the class can already cast (`bonusSpellsForScore`) |
| Domain spell slots | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Specialist wizard forbidden schools | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Caster level (global per class) | **Partial** | Not centralized on actor for checks |
| Penetration vs SR (Spell Penetration feats) | **Present** | The spell card rolls 1d20 + caster level + Spell Penetration. |
| Spell DC (10 + level + ability) | **Present** | Shown per spell and per slot; click a spell to post DC and an arcane failure check |
| Heightened / empowered metamagic adjusted DC & level | **Partial** | Spell sheet: Heighten changes DC and slot level. Empower, Extend, Still, Silent, and Quicken adjust the slot. Still ignores armor failure. Silent ignores deafened failure |
| Spell resistance check | **Present** | Casting a spell posts the spell resistance check. |
| Concentration (DC = 10 + damage + spell level, etc.) | **Partial** | Combat tab rolls Concentration against a DC you type. Combat Casting adds +4 |
| Defensive casting option | **Partial** | Combat tab toggle. Casting a spell then rolls Concentration vs 15 + slot level |
| Components V / S / M / F / DF / XP | **Partial** | Text on items at best |
| Arcane spell failure chance | **Partial** | Equipped armor/shield ASF (and deafened verbal failure) is rolled when an arcane spell is cast |
| Divine focus / inexpensive material defaults | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Somatic components in grapple | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Counterspells | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Dispel magic / greater dispel checks | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Buff stacking (same spell multiple times) | **Missing** | |
| Persistent / metamagic rods | **Missing** | |
| Swift / immediate action spells | **Missing** | Action economy missing |
| Summon lists & augmented summons | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Antimagic field / dead magic areas | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Domains & domain spells | **Partial** | **srd-domains** pack; linkage to preparation missing |
| Turn / rebuke undead | **Partial** | Turn check and 2d6 damage from cleric level and paladin (as a cleric three levels lower). Uses per day include Extra Turning |
| Turning damage / destruction thresholds | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Divine metamagic / divine feats | **Missing** | |
| Divine spell morality (cleric alignment) | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Paladin / ranger spell lists by level | **Partial** | Pack-only |

---

## 11. Psionics (SRD Expanded — if used)

| Topic | Status | Notes / gaps |
|-------|--------|----------------|
| Power **Item** compendium | **Partial** | `srd-powers` pack exists |
| Power points (reserve / spend / regain) | **Partial** | Identity shows a suggested reserve for psion (Intelligence), wilder (Charisma), and psychic warrior (Wisdom): class table plus that ability’s modifier. Spending, regaining, and the full bonus-point table are not tracked |
| Manifester level / discipline | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Display / augment | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Power resistance vs powers | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Psi-like abilities ( monsters ) | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Dorjes / power stones / cognizance crystals | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Wild surge / enervation (class variants) | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |

---

## 12. Monsters & NPCs

| Topic | Status | Notes / gaps |
|-------|--------|----------------|
| **NPC** actor sheet | **Present** | Includes trade / factions tab |
| Challenge Rating field | **Partial** | The NPC header shows DMG experience for that CR. Encounter CR for a mixed group is not calculated |
| Encounter EL / mixed CR calculator | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Monster ability scores & skills | **Partial** | Same model as PCs, including skill synergy. Good saves stay on the class or HD row |
| Monster type / subtype traits (construct, undead, swarm…) | **Missing** | No trait engine |
| Special attacks & qualities | **Partial** | Narrative + manual stats |
| Breath weapon DC (10 + ½ HD + Con) automation | **Partial** | `game.ctsdnd35.breathWeaponDc(hitDice, conMod)`. The NPC sheet does not fill a breath attack from it |
| Spell-like abilities per day | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Treasure type / encounter loot tables | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Advancement by HD / templates | **Missing** | |
| Half-celestial / half-fiend / lich template toggles | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Summoned creatures / generic tokens | **Missing** | |
| Mob rules / swarm math | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Bestiary compendium | **Present** | `srd-monsters` pack |

---

## 13. Environment & hazards

| Topic | Status | Notes / gaps |
|-------|--------|----------------|
| Falling damage | **Partial** | `game.ctsdnd35.fallingDamageDice(feet)` is 1d6 per 10 feet, maximum 20d6. No chat roll |
| Falling object damage | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Suffocation / drowning | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Fire / cold environmental damage | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Lava / acid immersion | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Starvation / thirst / forced Con damage | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Extreme heat / cold (Fort cycles) | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Light sources vs darkvision radius | **Partial** | Scene **Light** presets (day, overcast, dusk, moonlight, dark, magical darkness) set darkness and global light together. Low-light treats dim light as bright. Radius is still the light’s own bright/dim, not a doubled SRD radius. |
| Magical darkness vs mundane light | **Partial** | Magical darkness preset suppresses darkvision. Placed lights stay until the GM turns them off. |
| Weather & forced saves | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Wind effects on ranged attacks / flight | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Traps (Search / Disable / Reflex) | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Haunts / encounters tied to scenes | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |

---

## 14. Social play & downtime

| Topic | Status | Notes / gaps |
|-------|--------|----------------|
| Diplomacy / Gather Information DC scaffolding | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| NPC attitude track (hostile → helpful) | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Sense Motive vs Bluff | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Intimidate / demoralize | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Perform / bardic performance hooks | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Urban encounters / reputation | **Missing** | |
| Research / knowledge library downtime | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Training for new languages or ranks (time + gold) | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Spell research / item crafting downtime | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |

---

## 15. Economy & CTS-specific systems

| Topic | Status | Notes / gaps |
|-------|--------|----------------|
| Currency (cp/sp/gp/pp) | **Present** | Actor field |
| Selling gear (half base price, masterwork, magic) | **Partial** | `game.ctsdnd35.sellAtHalf(priceGp)` is half price, keeping a half-gold. Masterwork and magic pricing stay in the trade helpers |
| Trade goods / gems / art objects | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Loans / letters of credit / banks | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Craft / Profession income | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Item crafting cost & time (feats + spells) | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Treasure allocation | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Party loot sheet / merchant actor | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| **Faction** items & Gear % stacking | **Present** | Trade buyer modifiers |
| Race-based buyer/seller trade % | **Present** | NPC sheet + `computeGearPricePercentTotal` |
| Item pricing helpers | **Partial** | `adjustedGearPrice`; full SRD price tables not enforced |
| Cost adjustment by settlement size (optional house rule) | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |

---

## 16. Canvas, tokens & Foundry integration

| Topic | Status | Notes / gaps |
|-------|--------|----------------|
| Token ↔ actor link | **Present** | Foundry default |
| Vision modes on token | **Present** | Foundry; not driven by 3.5 sense aggregation |
| Darkvision / low-light radius from actor | **Partial** | Changing senses writes darkvision, low-light, or blindsight onto the token. Low-light upgrades shadowy light to bright. Magical darkness on the scene suppresses darkvision. |
| Multi-token linked summons | **Missing** | |
| Elevation / flight bands | **Partial** | Foundry scene features; not tied to 3.5 maneuverability |
| Grid diagonal policy (3.5 style) | **Present** | System setting enforces 5-10-5 option |
| Enforce 5-ft square scale | **Present** | World setting option in system init |
| Template placement / areas | **Missing** | Foundry tools manual |
| Measured templates & spell areas | **Partial** | Combat tab Rules panel, or the matching sheet field (`module/helpers/phb-rest.mjs`). |
| Walls / doors blocking LoS & movement | **Present** | Foundry walls; system does not validate 3.5 cover rules |
| Ruler & waypoints (movement audit) | **Present** | Foundry core |

---

## 17. UX, macros & authoring (benchmark vs D35E 3.0)

Capabilities described in [D35E 3.0.0](https://gitlab.com/dragonshorn/D35E/-/releases/3.0.0) as **aspirational** targets for any deep 3.5 Foundry system—not a CTS requirement list.

| Capability | CTS status |
|------------|------------|
| Threatened-area overlay & reach-aware melee | **Partial** | Reach ring around tokens (world setting). A circle, not a square-by-square map |
| Automatic flanking / threat detection at attack time | **Missing** |
| Formula builder / `@variable` picker on item fields | **Missing** |
| Equipment slot enforcement + bonus slots from effects | **Missing** |
| Advanced ammunition (no consume / ammo damage riders) | **Missing** |
| NPC treasure blocks & treasure generator hooks | **Missing** |
| Optional heavy combat tracker (actions, AoOs, buff ticks) | **Missing** |
| Encounter / initiative extensions beyond core Foundry | **Partial** | Core combat only |
| Compendium drag-drop onto sheet | **Present** | Foundry + your item types |
| System hooks documented for macro authors | **Partial** | `game.ctsdnd35` API surface small |

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
