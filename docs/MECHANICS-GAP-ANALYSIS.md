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

The largest systemic gap is a **unified modifier pipeline** (items/feats/buffs/conditions → derived stats). Without it, **most advanced 3.5** (stacking bonuses, AoOs, flanking, slots, encumbrance ACP, spell slots/DC, DR/resist, conditions, canvas threat) stays **manual or absent**. Secondary gaps: **spellcasting workflow**, **equipment rules**, **special combat actions**, **monster/treasure tooling**.

---

## 1. Character fundamentals

| Topic | Status | Notes / gaps |
|-------|--------|----------------|
| Ability scores & modifiers | **Present** | Effective score → `mod = floor((effective−10)/2)`; **`effective`** accounts for polymorph base, damage/drain/aging, optional fractional **bonus** (`actor.mjs`, ability-adjustments partial) |
| Ability damage / drain / burn | **Partial** | Per-ability **damage**, **drain**, **aging** fields reduce effective score; **burn** not a separate column (treat as drain or misc if needed) |
| Hit points (current / max / temp / nonlethal) | **Present** | Sheet inputs; **`tempSources`** array + derived **`tempSourcesSum`**; **dying**, stabilization, death threshold, massive damage — not automated |
| Constitution changes & HP | **Present** | On **character** actors, client that edits **Constitution `value`** adjusts **`hp.max`** and **`hp.value`** by **ΔCon modifier × total level** (PHB-style); see `actor-character-mechanics.mjs` |
| Level (total) | **Present** | Sum of **class** item levels (`actor.mjs`) |
| Experience points & next level | **Partial** | **`system.details.level.xp`** on sheet; legacy **`xpValue`** mirrored once; **`details.laBuyoffXp`** field for notes; **XP awards**, **multiclass penalty math**, **buyoff rules** — not automated |
| Favored class / multiclass XP penalty | **Partial** | **`details.favoredClass`**, **`details.racialFavoredClass`** + derived **`details.xpMulticlassHint`** (PHB reminder only); **no Table 3–6 math** |
| Race (SRD quick picks) | **Partial** | `config.mjs` racial presets + **race** items; **traits not auto-applied** to speed/abilities/skills centrally |
| Size category | **Present** | `traits.size`; feeds AC size mod & grapple; default **reach** table in **`CTSDND35.sizeReachFt`** (`config.mjs`) |
| Reach by size / creature | **Partial** | Derived **`traits.reachFt`** (+ **`traits.reachOverride`**) on actor/sheet header; **token reach / grid enforcement** still manual in Foundry |
| Speed — land / fly / swim / climb / burrow | **Partial** | **Land `total`**: base − **armor speed penalty** (item field or medium/heavy inference) − **encumbrance** (medium/heavy/overload) − **difficult terrain** (halve); **`armorPenaltyFt`** exposed; fly/swim/climb/burrow copy **base→total** only (no armor/encumbrance pipeline) |
| Alignment | **Present** | Stored; used in **feat** prereq checks |
| Deity, gender, biography, notes | **Present** | Narrative fields |
| Age, height, weight, eyes/hair | **Present** | **`system.details`**: `age`, `height`, `weight`, `eyes`, `hair` — Identity partial (+ NPC bio partial) |
| Languages | **Present** | **`details.languages`** text + **`details.literate`** (Yes/No); no structured tag list |
| Vision & senses (darkvision, low-light, etc.) | **Partial** | **`system.traits.senses`** (ranges + low-light/scent flags + notes) on sheet; **not** pushed to token vision / automation (contrast D35E) |
| Level drain / negative levels | **Present** | **`attributes.negativeLevels`** subtracts from **saves**, **skills**, **init**, **grapple**; **`bab.attackPenalty`** for display; **effective caster level / SLAs / HD-based abilities** — not reduced automatically |
| Creature type / subtype (PC) | **Present** | **`details.creatureType`**, **`details.creatureSubtype`** (free text); monsters still often manual stat blocks |
| Humanoid subtype / racial traits as flags | **Partial** | **`details.humanoidSubtype`** text; **no** feat/prerequisite wiring from subtype flags |
| Polymorph / wild shape “replacement stats” mode | **Present** | **`system.traits.polymorph`**: enable + replacement **Str/Dex/Con**; damage/drain/aging still apply on top |
| Aging bonuses & penalties (optional v3.5 tables) | **Partial** | Per-ability **`aging`** penalty points toward effective score; **no** baked-in middle-age/venerable tables |
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
| Base saves from class + level | **Partial** | Save **total** uses manual **base** inputs; **not** computed from per-class good/poor tables |
| Hit dice / HP at level 1 & beyond | **Partial** | Level-up wizard supports **fixed / roll / manual** style flow; full HD averaging rules table-side |
| Max HP vs rolled HP history | **Missing** | No audit trail per level |
| Skill points per level | **Partial** | Wizard + `getSkillRankCap`; multiclass **class skill lists** merged from packs |
| Human bonus skill point at 1st | **Partial** | Wizard narrative; not enforced as +4 vs +1 rule universally |
| Max ranks (class / cross-class) | **Present** | `getSkillRankCap` |
| Class skill flags on sheet | **Present** | Per-skill class checkbox |
| Cross-class max half-ranks ceiling | **Present** | Via cap formula; sheet editing can still error |
| Starting wealth / gear at level 1 | **Missing** | Not enforced |
| Wealth-by-level for higher starts | **Missing** | |
| Level drain affecting effective level for abilities | **Partial** | §1 **negative levels** penalize saves/skills/init/grapple/BAB display; **caster level / SLAs / features keyed to HD or level** — still manual |
| Prestige classes | **Partial** | Same **class** item; **entry requirements** beyond feats not systematically enforced |
| Class feature grants by level (automated) | **Partial** | `getClassFeatureGrants` in progression-rules; **application** to sheet mostly manual |
| Gestalt | **Partial** | `enableGestalt` setting; depth depends on wizard |
| NPC class vs PC class | **Partial** | Data can exist in packs; no separate NPC-class workflow |
| Monster racial HD vs class levels | **Missing** | No first-class “HD stack” model on actor |
| Spellcasting progression metadata | **Partial** | `getSpellcastingProgression` etc. in `progression-rules`; **slot/spells-known execution** thin |
| Multiclass spellcaster “combined slots” (UM rules) | **Missing** | |
| Familiar / animal companion / mount as linked actors | **Missing** | Foundry could link tokens; no system workflow |
| Rebuilding / PHB replacement levels | **Missing** | |

---

## 3. Skills

| Topic | Status | Notes / gaps |
|-------|--------|----------------|
| Full SRD skill list | **Present** | `CTSDND35.skills` |
| Trained-only skills | **Present** | `untrained` flag in config; enforcement on roll — **soft** |
| “Rank 0” trained-only retry behavior | **Missing** | |
| Ranks, ability mod, misc, **total** | **Present** | `actor.mjs` `_prepareSkills` |
| Circumstance / competence / insight bonuses (typed) | **Missing** | Single **misc** bucket only |
| Class skill vs cross-class **cost** | **Partial** | `getSkillPointCost` exists; wizard applies; **sheet direct-edit** can desync |
| Skill synergies | **Missing** | Must use misc |
| Armor check penalty on skills | **Missing** | Armor has no ACP field wired to skills |
| Double armor penalty (e.g. Swim) | **Missing** | |
| Fatigue / encumbrance to skills | **Missing** | |
| Tools & masterwork tools | **Missing** | |
| Skill tricks / substitution (non-SRD supplements) | **Missing** | Out of scope unless you add packs |
| Taking 10 / Taking 20 | **Missing** | |
| Distractions forbidding take 10 | **Missing** | |
| Aid another | **Missing** | |
| Opposed checks (Bluff vs Sense Motive, etc.) | **Missing** | Flat rolls only |
| Retry rules / special durations | **Missing** | |
| Individual skill APIs (e.g. Craft income, Decipher page/week) | **Missing** | Use narrative / manual |
| Appraise tied to **trade** pricing | **Partial** | `trade-modifiers` exists; **skill DC** for values not integrated |
| Knowledge checks vs DC tables | **Missing** | |
| Survival (track, endure elements, forecast) DC scaffolding | **Missing** | |
| Use Magic Device (emulate ability score / race / alignment) | **Missing** | |
| Speak Language / literacy (if using house list) | **Missing** | Pairs with §1 languages |
| Use Rope, Swim with armor | **Missing** | |
| Jump runs off moved speed (restriction) | **Missing** | Speed not rule-validated |
| Balance / Tumble vs narrow surface DCs | **Missing** | |

---

## 4. Feats, traits, class features

| Topic | Status | Notes / gaps |
|-------|--------|----------------|
| **Feat** items & list | **Present** | Character sheet list |
| Prerequisite parser | **Partial** | `evaluateFeatPrerequisites`: abilities, BAB, level, alignment axes, feat names, **some** skills/race/features |
| Prereq: spellcasting / caster level / specific spells known | **Missing** | Parser gaps |
| Prereq: race type (e.g. Undead) / creature subtype | **Missing** | |
| Fighter bonus feat slots / scaling | **Partial** | Wizard tracks selections; **no** global “feat slot budget” vs sources |
| Wizard bonus metamagic / item creation lists | **Missing** | |
| Stacking rules (same-source bonuses) | **Missing** | |
| Metamagic feats | **Missing** | No heightening workflow tied to spells |
| Item creation feats | **Missing** | |
| Leadership / cohort / followers | **Missing** | |
| Passive numeric bonuses from feats | **Partial** | No **Changes**/effect aggregation |
| **Feature** items (class features) | **Present** | Stored; mechanics manual |
| **Race** items | **Present** | Stored; mechanics manual |
| Alternate racial traits / subraces | **Partial** | Pack content only |
| Regional / background feats (if used) | **Missing** | Data-only via packs at best |
| Flaws / traits (UA-style, optional) | **Missing** | |

---

## 5. Combat — attacks & damage

| Topic | Status | Notes / gaps |
|-------|--------|----------------|
| **Weapon** / **attack** items | **Present** | Types exist |
| Melee attack bonus decomposition | **Partial** | Not one pipeline (BAB + Str/Dex + size + enhancement + morale + luck + …) |
| Str vs Dex on melee (finesse, rapier exception) | **Missing** | |
| Off-hand light weapon penalties | **Missing** | |
| Ranged attacks | **Partial** | Same; range increments / cover not automated |
| Range increments & cumulative −2 | **Missing** | |
| Projectile vs thrown weapon rules | **Missing** | |
| Iterative attacks (BAB −5, −10, …) | **Missing** | |
| Natural weapons & secondary attacks | **Missing** | |
| Primary / secondary natural attack BAB offset | **Missing** | |
| Unarmed strike & monk progression | **Missing** | |
| Touch attacks / ranged touch | **Partial** | AC touch computed; **attack mode** not distinguished in automation |
| Holding charge / touch spell through weapon | **Missing** | |
| Critical threat / confirmation / multiplier | **Missing** | |
| Keen / Improved Critical stacking limits | **Missing** | |
| Damage rolls & chat cards | **Partial** | Basic `Item.roll()` chat output |
| Damage types (B/S/P) & energy types | **Partial** | Schema varies by item; **DR interaction** missing |
| Half damage on successful save (spells) | **Missing** | |
| Precision damage (sneak attack, etc.) | **Missing** | |
| Critical immunity / fortification interaction | **Missing** | |
| Nonlethal damage | **Partial** | HP field exists; **weapon toggle / track** not wired |
| Splash weapons (alchemy, etc.) | **Missing** | |
| Weapon size / inappropriate size | **Missing** | |
| Reach weapon “dead zone” (10 ft. no adjacent) | **Missing** | |
| Two-weapon fighting penalties | **Missing** | |
| Manyshot / Rapid Shot / Flurry linkage | **Missing** | |
| Power Attack / Combat Expertise sliders | **Missing** | |
| Charge attack bonus / AC penalty | **Missing** | |
| Fighting defensively / total defense modifiers | **Missing** | |

---

## 6. Combat — AC, saves, resistances

| Topic | Status | Notes / gaps |
|-------|--------|----------------|
| AC (normal) | **Partial** | 10 + armor + shield + capped Dex + size + natural |
| Touch AC | **Present** | Derived line |
| Flat-footed AC | **Present** | Derived line |
| Lose Dex to AC (when applicable) | **Missing** | Flat-footed uses formula but **condition-driven** loss not wired |
| Dodge, deflection, insight, sacred, profane, luck, misc AC | **Missing** | Not item-driven; use house manual change to natural/bonus fields if at all |
| Max Dex bonus from armor | **Present** | Lowest equipped armor `maxDex` caps Dex to AC |
| Multiple armor pieces equipped edge case | **Partial** | Code sums equipped armor; **slot enforcement** absent |
| Shield spell / force effects | **Missing** | |
| Saving throws (Fort / Ref / Will total) | **Partial** | Base + ability + misc; base should tie to classes |
| Saving throw bonuses by source | **Missing** | No typed stacking |
| Circumstance bonuses on saves (good/neutral/evil aura, etc.) | **Missing** | |
| Damage reduction (DR) | **Missing** | |
| DR bypass materials / alignment / magic | **Missing** | |
| Energy resistance / immunity | **Missing** | |
| Vulnerability / healing amp for energy | **Missing** | |
| Spell resistance (SR) | **Partial** | Numeric field; **no** caster check workflow |
| Hardness & object HP | **Missing** | |
| Attacking objects / breaking doors | **Missing** | |
| Miss chance (concealment / blur / displacement) | **Missing** | |
| Incorporeal 50% miss vs nonmagical | **Missing** | |
| Fortification (crit immunity %) | **Missing** | |

---

## 7. Combat — actions, movement, positioning

| Topic | Status | Notes / gaps |
|-------|--------|----------------|
| Initiative order | **Present** | Foundry combat + sheet initiative roll |
| Initiative modifiers (feat, familiar, etc.) | **Partial** | Dex + misc init bonus field only |
| Flat-footed until first turn | **Missing** | Not flagged automatically |
| Turn structure (standard / move / swift / immediate / full-round) | **Missing** | |
| Full-round action lock (no 5-ft step) | **Missing** | |
| Delay / ready | **Missing** | |
| Charge, withdraw, run, tumble through threatened squares | **Missing** | |
| Run ×4 speed & straight-line limit | **Missing** | |
| 5-foot step | **Missing** | |
| Difficult terrain (half speed) | **Missing** | Foundry terrain ≠ rule enforcement |
| Hampered movement (climb/swim/balance) | **Missing** | |
| Grappling rules (initiate, hold, pin, damage, escape) | **Missing** | Grapple **modifier** shown only |
| Grapple size modifier table | **Missing** | |
| Trip, bull rush, overrun, disarm, sunder, feint | **Missing** | |
| Improved Trip / Stand from prone interactions | **Missing** | |
| Mounted combat | **Missing** | |
| Mounted archery / charge / leap | **Missing** | |
| Reach weapons & threatened squares | **Missing** | No geometry (D35E-style overlays absent) |
| Flanking (+2 melee) | **Missing** | |
| Soft cover from allies (Precise Shot gate) | **Missing** | |
| Attacks of opportunity | **Missing** | No counter / provoke logic |
| Provoking: casting in threat, ranged in threat, movement | **Missing** | |
| Tumble through threatened (vs AoO) | **Missing** | |
| Cover / concealment modifiers | **Missing** | |
| Higher ground, squeezing | **Missing** | |
| Teleport / dimension door & AoOs | **Missing** | |
| Underwater combat penalties | **Missing** | |

---

## 8. Conditions, healing, death

| Topic | Status | Notes / gaps |
|-------|--------|----------------|
| **Buff** item type | **Present** | Exists; **duration / combat-round** automation thin |
| SRD condition catalog (applied effects) | **Missing** | |
| Foundry **Active Effects** driving mods | **Missing** | `prepareDerivedData` does not consume unified effects |
| Condition duration (rounds / minutes / Dismissible) | **Missing** | |
| Fatigued / exhausted track | **Missing** | |
| Shaken / frightened / panicked | **Missing** | |
| Confused / fascinated | **Missing** | |
| Nauseated / sickened | **Missing** | |
| Stunned / dazed / helpless | **Missing** | |
| Paralyzed / petrified | **Missing** | |
| Sleeping / unconscious | **Missing** | |
| Prone modifiers (melee vs ranged) | **Missing** | |
| Invisible / blind | **Missing** | Foundry vision separate from 3.5 miss rules |
| Deafened / silence interaction | **Missing** | |
| Poison & disease (frequency, DC track) | **Missing** | |
| Ability damage / drain over time | **Missing** | See §1 |
| Energy drain stacking | **Missing** | |
| Stable / dying / dead | **Missing** | |
| Coup de grâce auto-hit / crit | **Missing** | |
| Massive damage Fort save | **Missing** | |
| Natural healing / long-term care | **Missing** | |
| Fast healing / regeneration | **Missing** | |
| Raise dead / resurrection / restoration (spell effects) | **Missing** | |
| Construct / undead immunity bundles | **Missing** | |

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
| Material (cold iron, silver, adamantine) | **Missing** | |
| Adamantine bypass hardness | **Missing** | |
| Weapon sizing & handedness | **Missing** | |
| Double weapons / two-bladed swords | **Missing** | |
| Ammunition & consumption | **Missing** | No ammo items workflow (see D35E patterns for reference only) |
| Thrown weapon returning / replenishing | **Missing** | |
| Charges / per-day item uses | **Partial** | Schema possible; no universal UI |
| Staff / wand / potion identification | **Missing** | |
| Weight & encumbrance | **Missing** | |
| Load limits by Strength | **Missing** | |
| Medium / heavy encumbrance penalties | **Missing** | |
| Body slots (ring ×2, head, eyes, …) | **Missing** | |
| Slotless / combining rules | **Missing** | |
| Drawing / sheathing / dropping | **Missing** | |
| Breaking / sundering gear | **Missing** | |
| Inventory sort / container nesting | **Partial** | Flat item list; Foundry folders manual |

---

## 10. Spells & divine casting

| Topic | Status | Notes / gaps |
|-------|--------|----------------|
| **Spell** items & per-level lists | **Partial** | Sheet lists by level |
| Spell preparation (Vancian) | **Missing** | |
| Spellbook / known spells list per class | **Missing** | |
| Spontaneous casting (known spells / slots) | **Missing** | |
| Spell slots per level | **Missing** | |
| Bonus spells from high ability | **Missing** | |
| Domain spell slots | **Missing** | |
| Specialist wizard forbidden schools | **Missing** | |
| Caster level (global per class) | **Partial** | Not centralized on actor for checks |
| Penetration vs SR (Spell Penetration feats) | **Missing** | |
| Spell DC (10 + level + ability) | **Missing** | |
| Heightened / empowered metamagic adjusted DC & level | **Missing** | |
| Spell resistance check | **Missing** | |
| Concentration (DC = 10 + damage + spell level, etc.) | **Missing** | Skill exists only as static total |
| Defensive casting option | **Missing** | |
| Components V / S / M / F / DF / XP | **Partial** | Text on items at best |
| Arcane spell failure chance | **Missing** | Not applied from armor |
| Divine focus / inexpensive material defaults | **Missing** | |
| Somatic components in grapple | **Missing** | |
| Counterspells | **Missing** | |
| Dispel magic / greater dispel checks | **Missing** | |
| Buff stacking (same spell multiple times) | **Missing** | |
| Persistent / metamagic rods | **Missing** | |
| Swift / immediate action spells | **Missing** | Action economy missing |
| Summon lists & augmented summons | **Missing** | |
| Antimagic field / dead magic areas | **Missing** | Canvas zones absent |
| Domains & domain spells | **Partial** | **srd-domains** pack; linkage to preparation missing |
| Turn / rebuke undead | **Missing** | |
| Turning damage / destruction thresholds | **Missing** | |
| Divine metamagic / divine feats | **Missing** | |
| Divine spell morality (cleric alignment) | **Missing** | |
| Paladin / ranger spell lists by level | **Partial** | Pack-only |

---

## 11. Psionics (SRD Expanded — if used)

| Topic | Status | Notes / gaps |
|-------|--------|----------------|
| Power **Item** compendium | **Partial** | `srd-powers` pack exists |
| Power points (reserve / spend / regain) | **Missing** | |
| Manifester level / discipline | **Missing** | |
| Display / augment | **Missing** | |
| Power resistance vs powers | **Missing** | |
| Psi-like abilities ( monsters ) | **Missing** | |
| Dorjes / power stones / cognizance crystals | **Missing** | |
| Wild surge / enervation (class variants) | **Missing** | |

---

## 12. Monsters & NPCs

| Topic | Status | Notes / gaps |
|-------|--------|----------------|
| **NPC** actor sheet | **Present** | Includes trade / factions tab |
| Challenge Rating field | **Partial** | Usable as label; encounter CR math not system-owned |
| Encounter EL / mixed CR calculator | **Missing** | |
| Monster ability scores & skills | **Partial** | Same model as PCs; **good saves / synergy** manual |
| Monster type / subtype traits (construct, undead, swarm…) | **Missing** | No trait engine |
| Special attacks & qualities | **Partial** | Narrative + manual stats |
| Breath weapon DC (10 + ½ HD + Con) automation | **Missing** | |
| Spell-like abilities per day | **Missing** | |
| Treasure type / encounter loot tables | **Missing** | D35E-style treasure % + generator — absent |
| Advancement by HD / templates | **Missing** | |
| Half-celestial / half-fiend / lich template toggles | **Missing** | |
| Summoned creatures / generic tokens | **Missing** | |
| Mob rules / swarm math | **Missing** | |
| Bestiary compendium | **Present** | `srd-monsters` pack |

---

## 13. Environment & hazards

| Topic | Status | Notes / gaps |
|-------|--------|----------------|
| Falling damage | **Missing** | |
| Falling object damage | **Missing** | |
| Suffocation / drowning | **Missing** | |
| Fire / cold environmental damage | **Missing** | |
| Lava / acid immersion | **Missing** | |
| Starvation / thirst / forced Con damage | **Missing** | |
| Extreme heat / cold (Fort cycles) | **Missing** | |
| Light sources vs darkvision radius | **Missing** | Foundry lighting ≠ SRD radii rules |
| Magical darkness vs mundane light | **Missing** | |
| Weather & forced saves | **Missing** | |
| Wind effects on ranged attacks / flight | **Missing** | |
| Traps (Search / Disable / Reflex) | **Missing** | |
| Haunts / encounters tied to scenes | **Missing** | Foundry journals manual |

---

## 14. Social play & downtime

| Topic | Status | Notes / gaps |
|-------|--------|----------------|
| Diplomacy / Gather Information DC scaffolding | **Missing** | Skills roll only |
| NPC attitude track (hostile → helpful) | **Missing** | |
| Sense Motive vs Bluff | **Missing** | |
| Intimidate / demoralize | **Missing** | |
| Perform / bardic performance hooks | **Missing** | |
| Urban encounters / reputation | **Missing** | |
| Research / knowledge library downtime | **Missing** | |
| Training for new languages or ranks (time + gold) | **Missing** | |
| Spell research / item crafting downtime | **Missing** | |

---

## 15. Economy & CTS-specific systems

| Topic | Status | Notes / gaps |
|-------|--------|----------------|
| Currency (cp/sp/gp/pp) | **Present** | Actor field |
| Selling gear (half base price, masterwork, magic) | **Missing** | Manual GP adjustment |
| Trade goods / gems / art objects | **Missing** | |
| Loans / letters of credit / banks | **Missing** | |
| Craft / Profession income | **Missing** | |
| Item crafting cost & time (feats + spells) | **Missing** | |
| Treasure allocation | **Missing** | |
| Party loot sheet / merchant actor | **Missing** | Foundry workaround only |
| **Faction** items & Gear % stacking | **Present** | Trade buyer modifiers |
| Race-based buyer/seller trade % | **Present** | NPC sheet + `computeGearPricePercentTotal` |
| Item pricing helpers | **Partial** | `adjustedGearPrice`; full SRD price tables not enforced |
| Cost adjustment by settlement size (optional house rule) | **Missing** | |

---

## 16. Canvas, tokens & Foundry integration

| Topic | Status | Notes / gaps |
|-------|--------|----------------|
| Token ↔ actor link | **Present** | Foundry default |
| Vision modes on token | **Present** | Foundry; not driven by 3.5 sense aggregation |
| Darkvision / low-light radius from actor | **Missing** | |
| Multi-token linked summons | **Missing** | |
| Elevation / flight bands | **Partial** | Foundry scene features; not tied to 3.5 maneuverability |
| Grid diagonal policy (3.5 style) | **Present** | System setting enforces 5-10-5 option |
| Enforce 5-ft square scale | **Present** | World setting option in system init |
| Template placement / areas | **Missing** | Foundry tools manual |
| Measured templates & spell areas | **Missing** | Not spell-aware |
| Walls / doors blocking LoS & movement | **Present** | Foundry walls; system does not validate 3.5 cover rules |
| Ruler & waypoints (movement audit) | **Present** | Foundry core |

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
