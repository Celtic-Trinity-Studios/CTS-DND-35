const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function generateId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 16; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function slugify(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
}

function parseSpellLevel(levelStr) {
    if (!levelStr) return 0;
    const match = levelStr.match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
}

function ensureDirSync(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

// Ensure output directories exist
const basePath = path.join(__dirname, '..', 'packs');
ensureDirSync(path.join(basePath, 'srd-spells', '_source'));
ensureDirSync(path.join(basePath, 'srd-feats', '_source'));
ensureDirSync(path.join(basePath, 'srd-monsters', '_source'));

// 1. Spells
console.log("Mapping Spells...");
let rawSpellsStr = fs.readFileSync(path.join(__dirname, 'raw_spells.json'), 'utf16le');
if(rawSpellsStr.charCodeAt(0) === 0xFEFF) rawSpellsStr = rawSpellsStr.slice(1);
const rawSpells = JSON.parse(rawSpellsStr);

rawSpells.forEach(row => {
    const comp = row.components ? row.components.toUpperCase() : "";
    const item = {
        _id: generateId(),
        name: row.name,
        type: "spell",
        system: {
            description: row.full_text || row.description || "",
            spellLevel: parseSpellLevel(row.level),
            school: row.school || "",
            components: {
                verbal: comp.includes('V'),
                somatic: comp.includes('S'),
                material: comp.includes('M'),
                focus: comp.includes('F') && !comp.includes('DF'),
                divineFocus: comp.includes('DF')
            },
            materialComponent: row.material_components || "",
            castingTime: row.casting_time || "",
            spellResistance: row.spell_resistance ? row.spell_resistance.toLowerCase().includes('yes') : false,
            prepared: false,
            domain: row.descriptor || ""
        }
    };
    const filename = `${slugify(item.name)}_${item._id}.json`;
    fs.writeFileSync(path.join(basePath, 'srd-spells', '_source', filename), JSON.stringify(item, null, 2), 'utf8');
});
console.log(`Saved ${rawSpells.length} Spells.`);

// 2. Feats
console.log("Mapping Feats...");
let rawFeatsStr = fs.readFileSync(path.join(__dirname, 'raw_feats.json'), 'utf16le');
if(rawFeatsStr.charCodeAt(0) === 0xFEFF) rawFeatsStr = rawFeatsStr.slice(1);
const rawFeats = JSON.parse(rawFeatsStr);

rawFeats.forEach(row => {
    const item = {
        _id: generateId(),
        name: row.name,
        type: "feat",
        system: {
            description: row.full_text || row.benefit || "",
            featType: row.type || "general",
            prerequisites: row.prerequisite || ""
        }
    };
    const filename = `${slugify(item.name)}_${item._id}.json`;
    fs.writeFileSync(path.join(basePath, 'srd-feats', '_source', filename), JSON.stringify(item, null, 2), 'utf8');
});
console.log(`Saved ${rawFeats.length} Feats.`);

// 3. Monsters
console.log("Mapping Monsters...");
let rawMonstersStr = fs.readFileSync(path.join(__dirname, 'raw_monsters.json'), 'utf16le');
if(rawMonstersStr.charCodeAt(0) === 0xFEFF) rawMonstersStr = rawMonstersStr.slice(1);
const rawMonsters = JSON.parse(rawMonstersStr);

rawMonsters.forEach(row => {
    let crMatch = row.challenge_rating ? row.challenge_rating.match(/\d+/) : null;
    let cr = crMatch ? parseInt(crMatch[0], 10) : 0;
    const item = {
        _id: generateId(),
        name: row.name,
        type: "npc",
        system: {
            details: {
                biography: row.full_text || "",
                cr: cr,
                environment: row.environment || "",
                organization: row.organization || "",
                treasure: row.treasure || ""
            },
            traits: {
                size: row.size || "med",
                type: row.type || "",
                subtype: row.descriptor || ""
            }
        }
    };
    const filename = `${slugify(item.name)}_${item._id}.json`;
    fs.writeFileSync(path.join(basePath, 'srd-monsters', '_source', filename), JSON.stringify(item, null, 2), 'utf8');
});
console.log(`Saved ${rawMonsters.length} Monsters.`);
