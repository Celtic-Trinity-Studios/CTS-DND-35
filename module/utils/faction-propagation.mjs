/**
 * Push one faction item's trade fields to every matching embedded copy on all world actors,
 * then sync actor group strings. Matching uses compendium/source UUIDs when present, then same name (case-insensitive).
 */

import { syncActorGroupsFromFactionItems } from "./faction-groups.mjs";
import { refreshActorDirectoryFactionFilters } from "../hooks/actor-faction-groups.mjs";
import { beginFactionBulkPush, endFactionBulkPush } from "./faction-bulk-push-guard.mjs";

function _normFactionName(s) {
  return String(s ?? "").trim().toLowerCase();
}

/**
 * @param {foundry.documents.Item} embed
 * @param {foundry.documents.Item} masterDoc
 * @param {string} [snapshotName] name from the sheet form (may differ from saved doc)
 */
export function embeddedFactionMatchesMaster(embed, masterDoc, snapshotName) {
  if (!embed || embed.type !== "faction" || !masterDoc || masterDoc.type !== "faction") return false;
  if (embed.id === masterDoc.id) return false;
  const mu = masterDoc.uuid;
  const flagSrc = embed.getFlag?.("core", "sourceId");
  if (flagSrc && flagSrc === mu) return true;
  const dup = embed.getFlag?.("core", "duplicateSource");
  if (dup && dup === mu) return true;
  const cs = embed._stats?.compendiumSource;
  if (cs && cs === mu) return true;
  const en = _normFactionName(embed.name);
  if (!en) return false;
  const snap = snapshotName ?? masterDoc.name;
  if (_normFactionName(snap) === en) return true;
  if (_normFactionName(masterDoc.name) === en) return true;
  return false;
}

/**
 * Persist master item, mirror to all other matching faction items on every actor, sync `details.groups`, refresh filters.
 * @returns {{ embeddedUpdated: number }}
 */
export async function propagateFactionSnapshotToAllActors(masterDoc, snapshot) {
  beginFactionBulkPush();
  try {
    const name = snapshot.name ?? masterDoc.name;
    const img = snapshot.img ?? masterDoc.img;
    const gearPct = Number(snapshot.system?.gearPct ?? masterDoc.system?.gearPct ?? 0);
    const safePct = Number.isFinite(gearPct) ? gearPct : 0;
    const description = snapshot.system?.description ?? masterDoc.system?.description ?? "";

    const mergedSystem = foundry.utils.mergeObject(foundry.utils.deepClone(masterDoc.system ?? {}), {
      gearPct: safePct,
      description,
    });

    try {
      await masterDoc.update({ name, img, system: mergedSystem });
    } catch (err) {
      console.warn("CTS DND 3.5 | Faction refresh could not update this faction item document:", err);
    }

    let embeddedUpdated = 0;
    for (const actor of game.actors ?? []) {
      const batch = [];
      for (const it of actor.items) {
        if (!embeddedFactionMatchesMaster(it, masterDoc, name)) continue;
        batch.push({
          _id: it.id,
          name,
          img,
          system: foundry.utils.mergeObject(foundry.utils.deepClone(it.system ?? {}), {
            gearPct: safePct,
            description,
          }),
        });
      }
      if (batch.length) {
        await actor.updateEmbeddedDocuments("Item", batch);
        embeddedUpdated += batch.length;
      }
    }

    for (const actor of game.actors ?? []) {
      await syncActorGroupsFromFactionItems(actor);
    }

    refreshActorDirectoryFactionFilters();

    return { embeddedUpdated };
  } finally {
    endFactionBulkPush();
  }
}
