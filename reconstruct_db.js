const fs = require('fs');
const path = require('path');
const { hashPin } = require('./src/main/security');

(async () => {
    // Reconstructed data
    const productos = [
        { nombre: "Taco de Asada", precio: 25, descripcion: "Recuperado" },
        { nombre: "Carnitas estilo Michoacan", precio: 25, descripcion: "Recuperado" },
        { nombre: "Papas Fritas", precio: 30, descripcion: "Recuperado" },
        { nombre: "Frijoles Charros", precio: 30, descripcion: "Recuperado" },
        { nombre: "Queso Fundido", precio: 40, descripcion: "Recuperado" }
    ];

    const bebidas = [
        { nombre: "Jugo de Naranja", precio: 20, tamano: "Vaso grande" },
        { nombre: "Cerveza", precio: 35, tamano: "Botella 355ml" },
        { nombre: "Agua de Jamaica", precio: 15, tamano: "Vaso" },
        { nombre: "Agua de Horchata", precio: 15, tamano: "Vaso" },
        { nombre: "Agua Natural", precio: 15, tamano: "Botella 600ml" },
        { nombre: "Coca-Cola", precio: 20, tamano: "Lata 355ml" }
    ];

    const extras = [
        { nombre: "Tortillas Extra", precio: 5 },
        { nombre: "Salsa Extra", precio: 5 },
        { nombre: "Guacamole", precio: 15 }
    ];

    const meserosNames = [
        "Ana Martínez",
        "Carlos Rodríguez",
        "María González",
        "Juan Pérez"
    ];

    const meseros = [];
    let idCounter = 1;

    // Hash default pin '1234' for meseros
    const defaultPin = await hashPin('1234');

    for (const name of meserosNames) {
        meseros.push({
            id: idCounter++,
            nombre: name,
            pin: defaultPin
        });
    }

    // Add IDs to products/etc
    const data = {
        productos: productos.map((p, i) => ({ id: i + 1, ...p })),
        bebidas: bebidas.map((b, i) => ({ id: i + 1, ...b })),
        extras: extras.map((e, i) => ({ id: i + 1, ...e })),
        meseros: meseros,
        tickets: [],
        administradores: [
            {
                id: 1,
                nombre: "Administrador Principal",
                pin: await hashPin('1234'), // Ensure we have access
                esPrincipal: true
            }
        ]
    };

    const db = {
        data: data,
        nextIds: {
            productos: data.productos.length + 1,
            bebidas: data.bebidas.length + 1,
            extras: data.extras.length + 1,
            meseros: data.meseros.length + 1,
            administradores: 2,
            tickets: 1
        },
        adminPin: null,
        settings: {
            restaurantName: "TAQUERÍA EL SABOR",
            address: "Dirección recuperada",
            contactInfo: "",
            thankYouMessage: "¡Gracias por su preferencia!",
            footerMessage: "Datos restaurados del sistema",
            enableTip: true
        }
    };

    fs.writeFileSync('restaurante_restored.json', JSON.stringify(db, null, 2));
    console.log('Restoration complete: restaurante_restored.json');
})();
