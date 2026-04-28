const { ClassicLevel } = require('classic-level');
const fs = require('fs');
const path = require('path');

async function packData() {
    const basePath = path.join(__dirname, 'packs');

    // 1. Pack Spells
    console.log("Packing Spells to LevelDB...");
    const spellsDb = new ClassicLevel(path.join(basePath, 'srd-spells'), { keyEncoding: 'utf8', valueEncoding: 'utf8' });
    await spellsDb.open();
    const spells = JSON.parse(fs.readFileSync(path.join(__dirname, 'srd-source', 'foundry_spells.json'), 'utf8'));
    let spellBatch = spellsDb.batch();
    for (const spell of spells) {
        // Foundry V11+ LevelDB Format requires stringified values
        spellBatch.put(`!items!${spell._id}`, JSON.stringify(spell));
    }
    await spellBatch.write();
    await spellsDb.close();
    console.log(`Successfully packed ${spells.length} spells into srd-spells.db`);

    // 2. Pack Feats
    console.log("Packing Feats to LevelDB...");
    const featsDb = new ClassicLevel(path.join(basePath, 'srd-feats'), { keyEncoding: 'utf8', valueEncoding: 'utf8' });
    await featsDb.open();
    const feats = JSON.parse(fs.readFileSync(path.join(__dirname, 'srd-source', 'foundry_feats.json'), 'utf8'));
    let featBatch = featsDb.batch();
    for (const feat of feats) {
        featBatch.put(`!items!${feat._id}`, JSON.stringify(feat));
    }
    await featBatch.write();
    await featsDb.close();
    console.log(`Successfully packed ${feats.length} feats into srd-feats.db`);

    // 3. Pack Monsters
    console.log("Packing Monsters to LevelDB...");
    const monstersDb = new ClassicLevel(path.join(basePath, 'srd-monsters'), { keyEncoding: 'utf8', valueEncoding: 'utf8' });
    await monstersDb.open();
    const monsters = JSON.parse(fs.readFileSync(path.join(__dirname, 'srd-source', 'foundry_monsters.json'), 'utf8'));
    let monsterBatch = monstersDb.batch();
    for (const monster of monsters) {
        monsterBatch.put(`!actors!${monster._id}`, JSON.stringify(monster));
    }
    await monsterBatch.write();
    await monstersDb.close();
    console.log(`Successfully packed ${monsters.length} monsters into srd-monsters.db`);
}

packData().catch(console.error);
