const { ClassicLevel } = require('classic-level');
const fs = require('fs');
const path = require('path');

function generateId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 16; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function readJson(filename) {
    let str = fs.readFileSync(path.join(__dirname, 'srd-source', filename), 'utf16le');
    if (str.charCodeAt(0) === 0xFEFF) str = str.slice(1);
    return JSON.parse(str);
}

function parseSpellLevel(levelStr) {
    if (!levelStr) return 0;
    const match = levelStr.match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
}

function stripHtml(value) {
    return String(value || "")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/&nbsp;/gi, " ")
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, "&")
        .replace(/<[^>]*>/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

function parseOrdinalLevel(text) {
    const m = String(text || "").match(/(\d+)(?:st|nd|rd|th)?/i);
    return m ? parseInt(m[1], 10) : 0;
}

function normalizeFeatureList(text) {
    const cleaned = stripHtml(text);
    if (!cleaned) return [];
    return cleaned
        .split(/,|;/)
        .map((part) => part.trim())
        .filter((part) => part && part !== "-" && part.toLowerCase() !== "none");
}

function parseClassProgressionTables(fullText) {
    const html = String(fullText || "");
    const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) => m[1]);
    let specialCol = -1;
    let spellCols = [];
    const featuresByLevel = {};
    const spellsPerDayByLevel = {};

    for (const rowHtml of rows) {
        const cells = [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => m[1]);
        if (!cells.length) continue;
        const textCells = cells.map((c) => stripHtml(c));

        // Header detection
        if (specialCol < 0 && textCells.some((t) => /^level$/i.test(t)) && textCells.some((t) => /^special$/i.test(t))) {
            specialCol = textCells.findIndex((t) => /^special$/i.test(t));
            spellCols = textCells
                .map((t, idx) => ({ t: t.toLowerCase(), idx }))
                .filter(({ t }) => t === "0" || /^[1-9](st|nd|rd|th)?$/.test(t))
                .map(({ t, idx }) => ({ spellLevel: parseOrdinalLevel(t), idx }));
            continue;
        }

        const level = parseOrdinalLevel(textCells[0]);
        if (!level) continue;

        if (specialCol >= 0 && textCells[specialCol] != null) {
            const feats = normalizeFeatureList(textCells[specialCol]);
            if (feats.length) featuresByLevel[level] = feats;
        }

        if (spellCols.length) {
            const perDay = {};
            for (const col of spellCols) {
                const cell = textCells[col.idx] ?? "";
                if (!cell || cell === "-" || /^—+$/.test(cell)) continue;
                const n = parseInt(cell, 10);
                if (Number.isFinite(n)) perDay[col.spellLevel] = n;
            }
            if (Object.keys(perDay).length) spellsPerDayByLevel[level] = { spellsPerDay: perDay };
        }
    }

    return { featuresByLevel, spellsPerDayByLevel };
}

async function openFreshDb(dbPath) {
    if (fs.existsSync(dbPath)) fs.rmSync(dbPath, { recursive: true, force: true });
    const db = new ClassicLevel(dbPath, { keyEncoding: 'utf8', valueEncoding: 'utf8' });
    await db.open();
    return db;
}

async function packData() {
    const basePath = path.join(__dirname, 'packs');

    // ===================== SPELLS =====================
    console.log("Packing Spells...");
    const spellsDb = await openFreshDb(path.join(basePath, 'srd-spells'));
    const rawSpells = readJson('raw_spells.json');
    let batch = spellsDb.batch();
    for (const row of rawSpells) {
        const comp = row.components ? row.components.toUpperCase() : "";
        const item = {
            _id: generateId(), name: row.name, type: "spell", img: "icons/svg/book.svg",
            system: {
                description: row.full_text || row.description || "", source: row.reference || "",
                spellLevel: parseSpellLevel(row.level), school: row.school || "",
                components: { verbal: comp.includes('V'), somatic: comp.includes('S'), material: comp.includes('M'), focus: comp.includes('F') && !comp.includes('DF'), divineFocus: comp.includes('DF') },
                materialComponent: row.material_components || "", castingTime: row.casting_time || "",
                spellResistance: row.spell_resistance ? row.spell_resistance.toLowerCase().includes('yes') : false,
                prepared: false, domain: row.descriptor || "",
                activation: { type: "", cost: 1 }, duration: { value: row.duration || "", units: "" },
                range: { value: row.range || "", units: "" }, target: { value: row.target || "", type: "" },
                uses: { value: 0, max: 0, per: "" }, actionType: "", attackBonus: "",
                damage: { parts: [] }, save: { ability: "", dc: null }, critical: { range: 20, multiplier: 2 },
                quantity: 1, weight: 0, price: 0, identified: true
            }
        };
        batch.put(`!items!${item._id}`, JSON.stringify(item));
    }
    await batch.write(); await spellsDb.close();
    console.log(`  ${rawSpells.length} spells packed.`);

    // ===================== FEATS =====================
    console.log("Packing Feats...");
    const featsDb = await openFreshDb(path.join(basePath, 'srd-feats'));
    const rawFeats = readJson('raw_feats.json');
    batch = featsDb.batch();
    for (const row of rawFeats) {
        const item = {
            _id: generateId(), name: row.name, type: "feat", img: "icons/svg/upgrade.svg",
            system: {
                description: row.full_text || row.benefit || "", source: row.reference || "",
                featType: (row.type || "general").toLowerCase(), prerequisites: row.prerequisite || "",
                activation: { type: "", cost: 1 }, duration: { value: "", units: "" },
                range: { value: null, units: "" }, target: { value: "", type: "" },
                uses: { value: 0, max: 0, per: "" }, actionType: "", attackBonus: "",
                damage: { parts: [] }, save: { ability: "", dc: null }, critical: { range: 20, multiplier: 2 },
                quantity: 1, weight: 0, price: 0, identified: true
            }
        };
        batch.put(`!items!${item._id}`, JSON.stringify(item));
    }
    await batch.write(); await featsDb.close();
    console.log(`  ${rawFeats.length} feats packed.`);

    // ===================== MONSTERS =====================
    console.log("Packing Monsters...");
    const monstersDb = await openFreshDb(path.join(basePath, 'srd-monsters'));
    const rawMonsters = readJson('raw_monsters.json');
    batch = monstersDb.batch();
    const sizeMap = { "Fine": "fine", "Diminutive": "dim", "Tiny": "tiny", "Small": "sm", "Medium": "med", "Large": "lg", "Huge": "huge", "Gargantuan": "grg", "Colossal": "col" };
    for (const row of rawMonsters) {
        let crMatch = row.challenge_rating ? row.challenge_rating.match(/[\d\/]+/) : null;
        const actor = {
            _id: generateId(), name: row.name, type: "npc", img: "icons/svg/mystery-man.svg",
            system: {
                abilities: { str:{value:10,mod:0,bonus:0}, dex:{value:10,mod:0,bonus:0}, con:{value:10,mod:0,bonus:0}, int:{value:10,mod:0,bonus:0}, wis:{value:10,mod:0,bonus:0}, cha:{value:10,mod:0,bonus:0} },
                attributes: {
                    hp:{value:0,max:0,temp:0,nonlethal:0}, ac:{normal:10,touch:10,flatFooted:10,naturalArmor:0},
                    init:{value:0,bonus:0,total:0}, bab:{value:0,total:0}, grapple:{value:0,total:0}, sr:{value:0,formula:""},
                    speed:{ land:{base:30,total:30}, fly:{base:0,total:0,maneuverability:"average"}, swim:{base:0,total:0}, climb:{base:0,total:0}, burrow:{base:0,total:0} },
                    savingThrows:{ fort:{base:0,ability:"con",bonus:0,total:0}, ref:{base:0,ability:"dex",bonus:0,total:0}, will:{base:0,ability:"wis",bonus:0,total:0} },
                    senses:{darkvision:0,blindsight:0,tremorsense:0,lowLight:false}
                },
                details: { alignment:"", race:"", deity:"", biography: row.full_text||row.stat_block||"", notes:"",
                    cr: crMatch ? crMatch[0] : "0", xpValue:0, source: row.reference||"",
                    environment: row.environment||"", organization: row.organization||"", treasure: row.treasure||"" },
                traits: { size: sizeMap[row.size]||"med", type: row.type||"", subtype: row.descriptor||"",
                    languages:[], damageReduction:[], energyResistance:[], specialQualities:[] },
                currency:{cp:0,sp:0,gp:0,pp:0}, skills:{}
            }
        };
        batch.put(`!actors!${actor._id}`, JSON.stringify(actor));
    }
    await batch.write(); await monstersDb.close();
    console.log(`  ${rawMonsters.length} monsters packed.`);

    // ===================== CLASSES =====================
    console.log("Packing Classes...");
    const classesDb = await openFreshDb(path.join(basePath, 'srd-classes'));
    const rawClasses = readJson('raw_classes.json');
    batch = classesDb.batch();
    for (const row of rawClasses) {
        const hdMatch = row.hit_die ? row.hit_die.match(/d(\d+)/) : null;
        const progression = parseClassProgressionTables(row.full_text || "");
        const item = {
            _id: generateId(), name: row.name, type: "class", img: "icons/svg/combat.svg",
            system: {
                description: row.full_text || "", source: row.reference || "",
                level: 0, hitDie: hdMatch ? `d${hdMatch[1]}` : "d8", bab: "med",
                saves: { fort: "low", ref: "low", will: "low" },
                skillRanksPerLevel: parseInt(row.skill_points) || 2,
                classSkills: row.class_skills ? row.class_skills.split(",").map(s => s.trim()) : [],
                requirements: {
                    req_base_attack_bonus: row.req_base_attack_bonus || "",
                    req_feat: row.req_feat || "",
                    req_race: row.req_race || "",
                    req_skill: row.req_skill || "",
                    req_alignment: row.alignment || "",
                    req_spells: row.req_spells || "",
                    req_special: row.req_special || ""
                },
                featuresByLevel: progression.featuresByLevel,
                spellcasting: {
                    type: row.spell_type || "none",
                    ability: row.spell_stat || "",
                    progression: progression.spellsPerDayByLevel
                },
                quantity: 1, weight: 0, price: 0, identified: true
            }
        };
        batch.put(`!items!${item._id}`, JSON.stringify(item));
    }
    await batch.write(); await classesDb.close();
    console.log(`  ${rawClasses.length} classes packed.`);

    // ===================== EQUIPMENT =====================
    console.log("Packing Equipment...");
    const equipDb = await openFreshDb(path.join(basePath, 'srd-equipment'));
    const rawEquip = readJson('raw_equipment.json');
    batch = equipDb.batch();
    for (const row of rawEquip) {
        const cat = (row.category || "").toLowerCase();
        let type = "equipment"; let extra = {};
        if (cat.includes("weapon") || row.dmg_m || row.dmg_s) {
            type = "weapon";
            const subcat = (row.subcategory || "").toLowerCase();
            let wt = "simple"; if (subcat.includes("martial")) wt = "martial"; else if (subcat.includes("exotic")) wt = "exotic";
            let ws = "melee"; if (subcat.includes("ranged") || row.range_increment) ws = "ranged";
            extra = { weaponType:wt, weaponSubtype:ws, proficient:true, enhancement:0, material:"", size:"med", properties:{},
                activation:{type:"standard",cost:1}, duration:{value:"",units:""}, range:{value:row.range_increment||null,units:row.range_increment?"ft":""},
                target:{value:"",type:""}, uses:{value:0,max:0,per:""}, actionType:ws==="melee"?"mwak":"rwak", attackBonus:"",
                damage:{parts:row.dmg_m?[[row.dmg_m,""]]:[]}, save:{ability:"",dc:null},
                critical:{range:row.critical?(parseInt(row.critical.match(/\d+/)?.[0])||20):20, multiplier:row.critical?(parseInt(row.critical.match(/x(\d+)/)?.[1])||2):2} };
        } else if (cat.includes("armor") || cat.includes("shield") || row.armor_shield_bonus) {
            type = "armor";
            const at = cat.includes("light")?"light":cat.includes("medium")?"medium":cat.includes("heavy")?"heavy":cat.includes("shield")?"shield":"light";
            extra = { armorType:at, acBonus:parseInt(row.armor_shield_bonus)||0, maxDex:row.maximum_dex_bonus?parseInt(row.maximum_dex_bonus):null,
                acp:parseInt(row.armor_check_penalty)||0, spellFailure:parseInt(row.arcane_spell_failure_chance)||0, enhancement:0, material:"", equipped:false, size:"med" };
        }
        const item = {
            _id: generateId(), name: row.name, type, img: type==="weapon"?"icons/svg/sword.svg":type==="armor"?"icons/svg/shield.svg":"icons/svg/chest.svg",
            system: { description: row.full_text||"", source: row.reference||"", quantity:1, weight:parseFloat(row.weight)||0,
                price: row.cost ? parseFloat(row.cost.replace(/[^0-9.]/g,''))||0 : 0, identified:true, ...extra }
        };
        batch.put(`!items!${item._id}`, JSON.stringify(item));
    }
    await batch.write(); await equipDb.close();
    console.log(`  ${rawEquip.length} equipment items packed.`);

    // ===================== MAGIC ITEMS =====================
    console.log("Packing Magic Items...");
    const itemsDb = await openFreshDb(path.join(basePath, 'srd-items'));
    const rawItems = readJson('raw_items.json');
    batch = itemsDb.batch();
    for (const row of rawItems) {
        const item = {
            _id: generateId(), name: row.name, type: "equipment", img: "icons/svg/item-bag.svg",
            system: { description: row.full_text||"", source: row.reference||"", equipmentType:"wondrous", equipped:false, slot:"slotless",
                quantity:1, weight:parseFloat(row.weight)||0, price: row.price ? parseFloat(row.price.replace(/[^0-9.]/g,''))||0 : 0, identified:true }
        };
        batch.put(`!items!${item._id}`, JSON.stringify(item));
    }
    await batch.write(); await itemsDb.close();
    console.log(`  ${rawItems.length} magic items packed.`);

    // ===================== DOMAINS =====================
    console.log("Packing Domains...");
    const domainsDb = await openFreshDb(path.join(basePath, 'srd-domains'));
    const rawDomains = readJson('raw_domains.json');
    batch = domainsDb.batch();
    for (const row of rawDomains) {
        const item = {
            _id: generateId(), name: row.name, type: "feature", img: "icons/svg/holy-shield.svg",
            system: { description: row.full_text||"", source: row.reference||"", featureType:"domain", classSource:"Cleric",
                activation:{type:"",cost:1}, duration:{value:"",units:""}, range:{value:null,units:""}, target:{value:"",type:""},
                uses:{value:0,max:0,per:""}, actionType:"", attackBonus:"", damage:{parts:[]}, save:{ability:"",dc:null},
                critical:{range:20,multiplier:2}, quantity:1, weight:0, price:0, identified:true }
        };
        batch.put(`!items!${item._id}`, JSON.stringify(item));
    }
    await batch.write(); await domainsDb.close();
    console.log(`  ${rawDomains.length} domains packed.`);

    // ===================== POWERS (Psionic) =====================
    console.log("Packing Psionic Powers...");
    const powersDb = await openFreshDb(path.join(basePath, 'srd-powers'));
    const rawPowers = readJson('raw_powers.json');
    batch = powersDb.batch();
    for (const row of rawPowers) {
        const item = {
            _id: generateId(), name: row.name, type: "spell", img: "icons/svg/lightning.svg",
            system: { description: row.full_text||row.description||"", source: row.reference||"",
                spellLevel: parseSpellLevel(row.level), school: row.discipline||"",
                components:{verbal:false,somatic:false,material:false,focus:false,divineFocus:false},
                materialComponent:"", castingTime: row.manifesting_time||"",
                spellResistance: row.power_resistance ? row.power_resistance.toLowerCase().includes('yes') : false,
                prepared:false, domain: row.descriptor||"",
                activation:{type:"",cost:1}, duration:{value:row.duration||"",units:""}, range:{value:row.range||"",units:""},
                target:{value:row.target||"",type:""}, uses:{value:0,max:0,per:""}, actionType:"", attackBonus:"",
                damage:{parts:[]}, save:{ability:"",dc:null}, critical:{range:20,multiplier:2},
                quantity:1, weight:0, price:0, identified:true }
        };
        batch.put(`!items!${item._id}`, JSON.stringify(item));
    }
    await batch.write(); await powersDb.close();
    console.log(`  ${rawPowers.length} psionic powers packed.`);

    console.log("\n✅ All compendiums packed successfully!");
}

packData().catch(console.error);
