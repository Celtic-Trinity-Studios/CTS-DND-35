# Character fundamentals — manual test checklist

Use this after pulling changes that touch **`module/documents/actor.mjs`**, **`module/hooks/actor-character-mechanics.mjs`**, **`module/sheets/actor-sheet.mjs`**, or character templates under **`templates/actor/`**.

**Environment:** Foundry **v14** (per `system.json`), load **CTS-DND-35**, create or open a **character** actor and an **NPC** actor if your sheet differs.

For each row: run the steps, then check **Expected**. Note failures with Foundry version, module list, and console errors.

**PC character sheet** uses **tabs** (Main, Combat, Skills, Features, Inventory, Status, Details). **Main** has the quick combat strip (HP / AC / Init) and attacks/saves. **Combat** embeds the full `actor-combat.hbs` partial (temp HP, negative levels, save bases, speed, etc.). **Status** has inner **Conditions | Spells** toggles (condition grid + vitality/notes vs spell item list), then **Buff** items. **Details** holds identity, senses, polymorph, and ability damage/drain/aging.

---

## 1. Ability scores, bonus, damage, drain, aging

| ✓ | Step | Expected |
|---|------|----------|
| ☐ | Open character sheet → expand **Ability damage / drain / aging** (extra panels). | Table shows **Bonus**, **Damage**, **Drain**, **Aging**, **Effective** per ability. |
| ☐ | Set Str **value** 18, **bonus** `0`, note modifier. Set **bonus** to `0.5`, submit/close field. | Modifier matches **`floor((floor(18.5 − penalties) − 10) / 2)`** (effective row shows integer effective score). |
| ☐ | Set **damage** 2 on Dex (value 14, no bonus). | Effective drops by 2; mod updates; tooltip/header tiles reflect **effective** where wired. |
| ☐ | Add **drain** and **aging** on same ability. | All three penalties reduce effective score together. |
| ☐ | Enable **polymorph** replacement (Identity) with Str **10**, base sheet Str still 18. | Physical abilities use replacement base + penalties; Int/Wis/Cha ignore polymorph scores. |

---

## 2. Constitution change → hit points

| ✓ | Step | Expected |
|---|------|----------|
| ☐ | Character with **two class levels** (total level 2), Con mod **+2**, note **hp.max** and **hp.value**. | Baseline recorded. |
| ☐ | Increase Con **value** so modifier becomes **+3** (Δ +1). Save/update on **your** client (GM or owner). | **hp.max** increases by **+2** (Δmod × level); **hp.value** increases by same amount (not negative below 1). |
| ☐ | Decrease Con so mod drops by 1. | **hp.max** and **hp.value** decrease by **level** each (floor toward 0 for value per implementation). |
| ☐ | Repeat on **NPC** or observe another GM user editing same actor. | Hook targets **character** type and **submitting user** — confirm no double adjustment when two clients edit; adjust expectations if testing multiplayer. |

---

## 3. Negative levels

| ✓ | Step | Expected |
|---|------|----------|
| ☐ | Set **negative levels** to **2** on Combat partial. | Fort/Ref/Will **total** each drop by 2; skill totals drop by 2; initiative total drops by 2; grapple drops by 2. |
| ☐ | Check BAB line / attack penalty display if present. | **Attack penalty** reflects NL for UI hint. |
| ☐ | Set NL back to **0**. | All totals recover. |

---

## 4. Speed (land), armor, encumbrance, terrain

| ✓ | Step | Expected |
|---|------|----------|
| ☐ | Set land **base** speed 30, no heavy armor, encumbrance **none**, terrain **normal**. | **Land total** 30; header **SPD** matches. |
| ☐ | Equip armor with **speed penalty** (or medium/heavy type if inferred). | **Land total** reduces; **`armorPenaltyFt`** (if shown) matches item logic. |
| ☐ | Set encumbrance to **medium**, then **heavy**. | Speed applies PHB-style multipliers (×⅔, ×½) after armor, minimum **5** ft. |
| ☐ | Set **difficult terrain** to **on** (select). | Land speed halves again (min **5**). |
| ☐ | Toggle difficult terrain off. | Restores prior total. |

---

## 5. Reach

| ✓ | Step | Expected |
|---|------|----------|
| ☐ | Set size **Large** (or other). | Header **Reach** matches **`sizeReachFt`** default for that size. |
| ☐ | Set **reach override** to a number (e.g. **10**). | Display uses override; clear override → default by size returns. |

---

## 6. Temporary HP sources

| ✓ | Step | Expected |
|---|------|----------|
| ☐ | Click **Add temp HP source**; enter label “Aid”, amount **10**. | Row appears; **Temp (tracked)** sum shows **10**. |
| ☐ | Add second source amount **5**. | Sum **15**. |
| ☐ | Trash/remove one row. | Sum updates; array persists after sheet close/reopen. |
| ☐ | Edit **manual Temp HP** field. | Still independent from **tempSourcesSum** (two parallel tracks by design). |

---

## 7. Status tab (vitality, notes, buffs)

| ✓ | Step | Expected |
|---|------|----------|
| ☐ | Open **Status** tab. | **Conditions | Spells** sub-tabs appear; **Conditions** shows a compact checkbox grid, vitality, and notes; **Spells** lists spell items (or empty hint). |
| ☐ | Toggle several **condition** checkboxes (must not be `disabled` in DOM). | Each updates `system.details.status.conditions.<key>`; refresh sheet — states persist. |
| ☐ | Set vitality to **Unconscious**, add notes, save. | `system.details.status` persists (vitality is separate from condition checkboxes). |
| ☐ | Drag a **Buff** item onto the actor; open item → **Details** → set **Active**. | Status tab shows ✓ for active buff. |

---

## 8. Identity, languages, senses, polymorph flags

| ✓ | Step | Expected |
|---|------|----------|
| ☐ | Fill **age**, **height**, **weight**, **eyes**, **hair**, **languages**; toggle **Literacy** Yes/No. | Values persist after save; selects do not stick as string `"false"` bugs (booleans in data). |
| ☐ | Set **favored class** and **racial favored class** with two class items leveled. | **XP multiclass hint** appears (reminder text only). |
| ☐ | Enter **LA buyoff XP** if you use it. | Field saves; no automatic level math required. |
| ☐ | Enter **creature type**, **subtype**, **humanoid subtype**. | Persists; no automated prerequisite checks. |
| ☐ | Senses: darkvision range, **low-light** Yes/No, **scent** Yes/No, notes. | Saves correctly; **token** vision does **not** auto-update (manual). |
| ☐ | **Polymorph**: Replace physical scores **Yes**, set Str/Dex/Con; **No** clears use of replacements. | Booleans coerce correctly; abilities match §1 tests. |

---

## 9. XP field binding

| ✓ | Step | Expected |
|---|------|----------|
| ☐ | Edit **XP** in header. | Updates **`system.details.level.xp`**; no silent loss on refresh. |
| ☐ | Actor with legacy **`details.xpValue`** only (if you still have a test JSON). | One-time migration to **`level.xp`** when **`level.xp`** was 0 (regression test if applicable). |

---

## 10. NPC / Bio tab

| ☐ | Open **NPC** sheet → Bio (or equivalent) if identity partial is duplicated there. | Identity + ability adjustments visible and save like PC where intended. |

---

## 11. Regression sniff tests

| ☐ | On **character** sheet, **Combat Stats → HP** shows two editable fields (current / max), not read-only `0 / 0` text. | Values persist after close/reopen. |
| ☐ | Level-up wizard / character wizard still opens; class levels still sum to **Level**. | No thrown errors in console. |
| ☐ | Roll ability / save / skill from sheet. | Uses derived mods including NL and effective abilities. |

---

## Quick pass / smoke (≈2 minutes)

1. New character → set abilities → change Con → check HP.  
2. Set NL = 1 → confirm save total drops by 1.  
3. Armor + encumbrance + difficult terrain on same actor → land speed plausible.  
4. Add temp HP source row → sum correct.  
5. Enable polymorph Str → Str mod matches replacement column.  
6. **Status** tab: tick several **condition** checkboxes; vitality + notes; buff ✓ when item active.

Record **date**, **Foundry build**, and **system version** (`system.json` **version**) on each full pass.
