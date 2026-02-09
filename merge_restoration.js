const fs = require('fs');
const { hashPin } = require('./src/main/security');

(async () => {
    try {
        const sqliteData = JSON.parse(fs.readFileSync('extracted_data.json', 'utf8')).data;

        let currentDb = {};
        try {
            currentDb = JSON.parse(fs.readFileSync('dump_restaurante.json', 'utf8'));
        } catch (e) {
            console.log('No dump_restaurante.json found, using defaults for settings');
        }

        const defaultPin = await hashPin('1234');

        // Process Meseros (add pins)
        const meseros = (sqliteData.meseros || []).map(m => ({
            id: m.id,
            nombre: m.nombre,
            pin: m.pin || defaultPin
        }));

        // Process Products (ensure numbers)
        const productos = (sqliteData.productos || []).map(p => ({
            id: p.id,
            nombre: p.nombre,
            precio: Number(p.precio),
            descripcion: p.descripcion || ''
        }));

        const bebidas = (sqliteData.bebidas || []).map(b => ({
            id: b.id,
            nombre: b.nombre,
            precio: Number(b.precio),
            tamano: b.tamano || ''
        }));

        const extras = (sqliteData.extras || []).map(e => ({
            id: e.id,
            nombre: e.nombre,
            precio: Number(e.precio)
        }));

        // Process Tickets (if any)
        const tickets = (sqliteData.tickets || []).map(t => ({
            ...t
        }));

        // Construct final DB
        const finalDb = {
            data: {
                productos,
                bebidas,
                extras,
                meseros,
                tickets, // Empty from sqlite but harmless
                administradores: [
                    {
                        "id": 1,
                        "nombre": "Administrador Principal",
                        "pin": defaultPin, // Known working pin
                        "esPrincipal": true
                    }
                ]
            },
            nextIds: {
                productos: productos.length + 1,
                bebidas: bebidas.length + 1,
                extras: extras.length + 1,
                meseros: meseros.length + 1,
                administradores: 2,
                tickets: tickets.length + 1
            },
            adminPin: null,
            settings: currentDb.settings || {
                "restaurantName": "TAQUERÍA EL SABOR",
                "enableTip": true
            },
            statsCache: { dashboard: null, admin: null },
            saveTimeout: null,
            isDirty: false
        };

        fs.writeFileSync('restaurante_merged.json', JSON.stringify(finalDb, null, 2));
        console.log('Merge complete: restaurante_merged.json');

    } catch (e) {
        console.error(e);
    }
})();
