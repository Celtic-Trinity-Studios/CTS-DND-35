# Using CTS DND 3.5 features in your world

This guide is for **GMs and players** setting up and playing with world-facing mechanics that ship in the system (merchant shops, coin, and trade modifiers). It assumes your game is already using the **CTS DND 3.5** system.

> **Note:** Detailed mechanics audits live in other docs (for example `MECHANICS-GAP-ANALYSIS.md`). This file focuses on **what to click** and **what to configure** at the table.

---

## NPC merchant shop

The system includes a **built-in shop UI**: buy from an NPC’s inventory and (optionally) sell eligible gear back. You do **not** need the Item Piles module for this workflow.

### GM: turn an NPC into a merchant

1. Create or open an **NPC** actor (Actors sidebar).
2. Open the **Inventory** tab on the NPC sheet.
3. At the top of that tab, find the **Shop** section.
4. Enable **This NPC is a merchant**, then **save** the sheet (close it or submit so changes persist).

Optional settings (same section):

| Setting | Purpose |
|--------|---------|
| **Purchase only** | Players can buy from the NPC but **cannot** sell items back. |
| **Listed buy price ×** | Multiplier applied to each item’s **Price** before racial/faction trade rules (default `1`). |
| **Sell-back price ×** | Multiplier applied when the NPC **buys** junk from PCs (default `0.5`, i.e. half of the adjusted base sell value unless you change trade rules). |

### GM: stock the store

Everything for sale is normal inventory on that NPC:

1. Stay on the NPC’s **Inventory** tab (or drag from compendiums / Items sidebar onto the sheet).
2. Add items whose types are supported for trade: **weapon**, **armor**, **equipment**, **consumable**.
3. Set each item’s **Price** (gold-piece book value on the item).
4. Use **quantity** for stackables (arrows, potions, etc.). Single objects can stay at quantity `1`.

Spells, feats, classes, and similar types **do not** appear in the shop lists.

### GM: give the merchant enough coin (sell-back)

When a PC **sells** to the merchant, the NPC pays out of its **Currency** fields on the Inventory tab (CP / SP / GP / PP). If the merchant cannot cover the payout, the transaction fails with a warning. Seed the NPC with enough precious metal before sessions where buyback matters.

### Opening the shop (GM or players)

1. **Pick who is shopping:** The buyer must be a **player character** actor.
   - The sheet looks for a **selected token** on the canvas whose actor is a **character**. If none, it uses your **assigned character** (Foundry user configuration).
2. On the merchant NPC sheet (Inventory tab → Shop), click **Open shop**.

The window shows:

- The **buyer’s** current coins and an approximate total in gp for reference.
- **Buy from merchant:** listed unit prices use item price × merchant buy multiplier × your **Trade & factions** rules (see below).
- **Sell to merchant:** hidden entirely if **Purchase only** is checked.

**Players** normally open the shop while they control their PC token (or have an assigned character). If the GM owns the merchant NPC, trades still run: the system sends a short **socket request** to the GM client to apply inventory and currency updates.

### Macros and API (advanced)

From an **Execute** macro or the console:

```javascript
// merchant and buyer can be Actor instances or actor IDs
game.ctsdnd35.openMerchantShop(merchantActorOrId, buyerActorOrId);
```

Use this when you want a macro button or session flow that skips opening the NPC sheet.

---

## Trade and faction price modifiers

Characters and NPCs can carry **Faction** items and use **Trade & factions** tab rows (race-based modifiers). Those percentages stack with listed **gear** bonuses from faction affiliations and affect **merchant prices** the same way they affect adjusted gear prices elsewhere in the system.

Practical tips:

- Put **race** strings on both buyer and seller when you rely on “race vs race” rows (NPC sheet Race field, buyer Identity race).
- For merchants, the NPC sheet explains **race mods selling** (seller-side) vs the buyer’s **race trade mods**.

When in doubt, open the merchant window: unit prices shown already include those modifiers for the **currently selected buyer**.

---

## Currency model

- Actor wallets use **CP, SP, GP, PP** on the sheet (Inventory tab for PCs/NPCs).
- Shops convert internally using standard **10 cp = 1 sp**, **10 sp = 1 gp**, **10 gp = 1 pp** math when moving coin.

---

## Quick troubleshooting

| Issue | What to check |
|-------|----------------|
| **Open shop** does nothing / warns | Merchant checkbox saved? Buyer selected (token or assigned character)? |
| Sell fails (“merchant cannot pay”) | Add PP/GP/SP/CP to the **NPC merchant** actor. |
| Prices look wrong | Item **Price** field, merchant multipliers, Trade & factions tab, faction items on the buyer. |
| Player cannot trade | They must **own** their character actor (normal Foundry permissions). |

---

## Release packaging

This file lives under `docs/` in the repository so it is easy to read on GitHub. The downloadable **system zip** for Foundry includes `README.md` but not the whole `docs/` tree; keep critical table instructions duplicated in **README** if you need them inside the installed package.
