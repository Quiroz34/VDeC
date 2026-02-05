const path = require('path');
const fs = require('fs');
const { app } = require('electron');
const { hashPin, verifyPin, isHashed } = require('./security');

class DatabaseManager {
    constructor() {
        this.dbPath = path.join(app.getPath('userData'), 'restaurante.json');
        this.data = {
            productos: [],
            bebidas: [],
            extras: [],
            meseros: [],
            tickets: []
        };
        this.nextIds = {
            productos: 1,
            bebidas: 1,
            extras: 1,
            meseros: 1,
            tickets: 1
        };
        this.adminPin = null; // Will be hashed
        this.settings = {
            restaurantName: 'TAQUERÍA EL SABOR',
            address: 'Dirección no configurada',
            thankYouMessage: '¡Gracias por su preferencia!',
            enableTip: true
        };
        this.statsCache = {
            dashboard: null,
            admin: null
        };
        this.saveTimeout = null;
        this.isDirty = false;
    }

    async initDatabase() {
        // Cargar base de datos existente o crear una nueva
        if (fs.existsSync(this.dbPath)) {
            try {
                const fileData = fs.readFileSync(this.dbPath, 'utf8');
                const loaded = JSON.parse(fileData);
                this.data = loaded.data || this.data;
                this.nextIds = loaded.nextIds || this.nextIds;
                this.adminPin = loaded.adminPin;
                this.settings = loaded.settings || this.settings;

                // Migrar PINs si no están hasheados
                await this.migratePinsIfNeeded();
            } catch (error) {
                console.error('Error loading database:', error);

                // CRITICAL FIX: Backup corrupted file instead of overwriting
                const timestamp = new Date().toISOString().replace(/:/g, '-');
                const backupPath = `${this.dbPath}.corrupt.${timestamp}`;

                try {
                    fs.copyFileSync(this.dbPath, backupPath);
                    console.error(`CRITICAL: Database corrupted. Backup created at ${backupPath}`);
                } catch (backupError) {
                    console.error('Failed to create backup of corrupted database:', backupError);
                }

                // Now safe to start fresh
                await this.insertSampleData();
            }
        } else {
            await this.insertSampleData();
        }

        await this._saveToDisk(); // Initial save
    }

    // ... (omitting unchanged methods for brevity if possible, but replace_file_content needs context) ...

    async migratePinsIfNeeded() {
        // ... (keeping implementation, just ensuring initDatabase calls _saveToDisk)
        let needsSave = false;
        // ... implementation ...
        if (this.adminPin && !isHashed(this.adminPin)) {
            this.adminPin = await hashPin(this.adminPin);
            needsSave = true;
        } else if (!this.adminPin) {
            this.adminPin = await hashPin('1234');
            needsSave = true;
        }

        for (let mesero of this.data.meseros) {
            if (mesero.pin && !isHashed(mesero.pin)) {
                mesero.pin = await hashPin(mesero.pin);
                needsSave = true;
            }
        }

        if (needsSave) {
            await this._saveToDisk();
            console.log('Migración de PINs completada');
        }
    }

    // ... 

    // Guardado optimizado con DEBOUNCING
    async save() {
        this.isDirty = true;
        this.statsCache.dashboard = null; // Invalidate cache
        this.statsCache.admin = null;

        // Si ya hay un timer pendiente, cancelarlo
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }

        // Programar nuevo guardado en 2 segundos
        this.saveTimeout = setTimeout(async () => {
            await this._saveToDisk();
        }, 2000);

        // Retornar éxito inmediato a la UI para no bloquear
        return { success: true };
    }

    // Escritura real en disco (Privado)
    async _saveToDisk() {
        try {
            if (!this.isDirty && fs.existsSync(this.dbPath)) return; // No escribir si no hay cambios

            const dataToSave = {
                data: this.data,
                nextIds: this.nextIds,
                adminPin: this.adminPin,
                settings: this.settings
            };

            // Escritura atómica para evitar corrupción
            const tempPath = `${this.dbPath}.tmp`;
            await fs.promises.writeFile(tempPath, JSON.stringify(dataToSave, null, 2), 'utf8');
            await fs.promises.rename(tempPath, this.dbPath);

            this.isDirty = false;
            console.log('Database saved to disk');
        } catch (error) {
            console.error('Error saving database to disk:', error);
            // No lanzamos error aquí para no romper el flujo asíncrono, pero logueamos
        }
    }

    // Forzar guardado inmediato (para cerrar app)
    async close() {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        if (this.isDirty) {
            console.log('Forcing save on close...');
            await this._saveToDisk();
        }
    }

    // Validación de entrada
    validateProducto(producto) {
        if (!producto.nombre || typeof producto.nombre !== 'string' || producto.nombre.trim() === '') {
            throw new Error('Nombre de producto inválido');
        }
        if (typeof producto.precio !== 'number' || producto.precio < 0) {
            throw new Error('Precio inválido');
        }
        return true;
    }

    validateBebida(bebida) {
        if (!bebida.nombre || typeof bebida.nombre !== 'string' || bebida.nombre.trim() === '') {
            throw new Error('Nombre de bebida inválido');
        }
        if (typeof bebida.precio !== 'number' || bebida.precio < 0) {
            throw new Error('Precio inválido');
        }
        return true;
    }

    validateExtra(extra) {
        if (!extra.nombre || typeof extra.nombre !== 'string' || extra.nombre.trim() === '') {
            throw new Error('Nombre de extra inválido');
        }
        if (typeof extra.precio !== 'number' || extra.precio < 0) {
            throw new Error('Precio inválido');
        }
        return true;
    }

    validateMesero(mesero) {
        if (!mesero.nombre || typeof mesero.nombre !== 'string' || mesero.nombre.trim() === '') {
            throw new Error('Nombre de mesero inválido');
        }
        if (mesero.pin && !/^\d{4}$/.test(mesero.pin)) {
            throw new Error('PIN debe ser de 4 dígitos numéricos');
        }
        return true;
    }

    // Función helper para inferir tipo de producto
    inferProductType(nombre) {
        const esBebida = this.data.bebidas.some(b => b.nombre === nombre);
        const esExtra = this.data.extras.some(e => e.nombre === nombre);
        return esBebida ? 'bebidas' : (esExtra ? 'extras' : 'tacos');
    }

    // CRUD Productos
    getProductos() {
        return this.data.productos.sort((a, b) => a.nombre.localeCompare(b.nombre));
    }

    async addProducto(producto) {
        try {
            this.validateProducto(producto);
            const newProducto = {
                id: this.nextIds.productos++,
                nombre: producto.nombre.trim(),
                precio: parseFloat(producto.precio),
                descripcion: producto.descripcion ? producto.descripcion.trim() : ''
            };
            this.data.productos.push(newProducto);
            await this.save();
            return { success: true, id: newProducto.id };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async updateProducto(id, producto) {
        try {
            this.validateProducto(producto);
            const index = this.data.productos.findIndex(p => p.id === parseInt(id));
            if (index === -1) {
                return { success: false, error: 'Producto no encontrado' };
            }
            this.data.productos[index] = {
                id: parseInt(id),
                nombre: producto.nombre.trim(),
                precio: parseFloat(producto.precio),
                descripcion: producto.descripcion ? producto.descripcion.trim() : ''
            };
            await this.save();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async deleteProducto(id) {
        try {
            const initialLength = this.data.productos.length;
            this.data.productos = this.data.productos.filter(p => p.id !== parseInt(id));
            if (this.data.productos.length === initialLength) {
                return { success: false, error: 'Producto no encontrado' };
            }
            await this.save();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // CRUD Bebidas
    getBebidas() {
        return this.data.bebidas.sort((a, b) => a.nombre.localeCompare(b.nombre));
    }

    async addBebida(bebida) {
        try {
            this.validateBebida(bebida);
            const newBebida = {
                id: this.nextIds.bebidas++,
                nombre: bebida.nombre.trim(),
                precio: parseFloat(bebida.precio),
                tamano: bebida.tamano ? bebida.tamano.trim() : ''
            };
            this.data.bebidas.push(newBebida);
            await this.save();
            return { success: true, id: newBebida.id };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async updateBebida(id, bebida) {
        try {
            this.validateBebida(bebida);
            const index = this.data.bebidas.findIndex(b => b.id === parseInt(id));
            if (index === -1) {
                return { success: false, error: 'Bebida no encontrada' };
            }
            this.data.bebidas[index] = {
                id: parseInt(id),
                nombre: bebida.nombre.trim(),
                precio: parseFloat(bebida.precio),
                tamano: bebida.tamano ? bebida.tamano.trim() : ''
            };
            await this.save();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async deleteBebida(id) {
        try {
            const initialLength = this.data.bebidas.length;
            this.data.bebidas = this.data.bebidas.filter(b => b.id !== parseInt(id));
            if (this.data.bebidas.length === initialLength) {
                return { success: false, error: 'Bebida no encontrada' };
            }
            await this.save();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // CRUD Extras
    getExtras() {
        return this.data.extras.sort((a, b) => a.nombre.localeCompare(b.nombre));
    }

    async addExtra(extra) {
        try {
            this.validateExtra(extra);
            const newExtra = {
                id: this.nextIds.extras++,
                nombre: extra.nombre.trim(),
                precio: parseFloat(extra.precio)
            };
            this.data.extras.push(newExtra);
            await this.save();
            return { success: true, id: newExtra.id };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async updateExtra(id, extra) {
        try {
            this.validateExtra(extra);
            const index = this.data.extras.findIndex(e => e.id === parseInt(id));
            if (index === -1) {
                return { success: false, error: 'Extra no encontrado' };
            }
            this.data.extras[index] = {
                id: parseInt(id),
                nombre: extra.nombre.trim(),
                precio: parseFloat(extra.precio)
            };
            await this.save();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async deleteExtra(id) {
        try {
            const initialLength = this.data.extras.length;
            this.data.extras = this.data.extras.filter(e => e.id !== parseInt(id));
            if (this.data.extras.length === initialLength) {
                return { success: false, error: 'Extra no encontrado' };
            }
            await this.save();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Meseros
    getMeseros() {
        // No devolver PINs al frontend
        return this.data.meseros.map(m => ({
            id: m.id,
            nombre: m.nombre
        })).sort((a, b) => a.nombre.localeCompare(b.nombre));
    }

    async addMesero(mesero) {
        try {
            this.validateMesero(mesero);
            const pin = mesero.pin || '1234';
            const hashedPin = await hashPin(pin);

            const newMesero = {
                id: this.nextIds.meseros++,
                nombre: mesero.nombre.trim(),
                pin: hashedPin
            };
            this.data.meseros.push(newMesero);
            await this.save();
            return { success: true, id: newMesero.id };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async updateMesero(id, mesero) {
        try {
            this.validateMesero(mesero);
            const index = this.data.meseros.findIndex(m => m.id === parseInt(id));
            if (index === -1) {
                return { success: false, error: 'Mesero no encontrado' };
            }

            const updated = {
                id: parseInt(id),
                nombre: mesero.nombre.trim(),
                pin: this.data.meseros[index].pin // Mantener PIN existente
            };

            // Si se proporciona nuevo PIN, hashearlo
            if (mesero.pin) {
                updated.pin = await hashPin(mesero.pin);
            }

            this.data.meseros[index] = updated;
            await this.save();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async deleteMesero(id) {
        try {
            const initialLength = this.data.meseros.length;
            this.data.meseros = this.data.meseros.filter(m => m.id !== parseInt(id));
            if (this.data.meseros.length === initialLength) {
                return { success: false, error: 'Mesero no encontrado' };
            }
            await this.save();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Validar PIN de mesero
    async validateMeseroPin(meseroId, pin) {
        try {
            const mesero = this.data.meseros.find(m => m.id === parseInt(meseroId));
            if (!mesero) {
                return { success: false, error: 'Mesero no encontrado' };
            }

            const isValid = await verifyPin(pin, mesero.pin);
            if (isValid) {
                return {
                    success: true,
                    mesero: { id: mesero.id, nombre: mesero.nombre }
                };
            }
            return { success: false, error: 'PIN incorrecto' };
        } catch (error) {
            console.error('Error validando PIN:', error);
            return { success: false, error: 'Error de validación' };
        }
    }

    // Validar PIN de administrador
    async validateAdminPin(pin) {
        try {
            const isValid = await verifyPin(pin, this.adminPin);
            if (isValid) {
                return { success: true };
            }
            return { success: false, error: 'PIN de administrador incorrecto' };
        } catch (error) {
            console.error('Error validando PIN admin:', error);
            return { success: false, error: 'Error de validación' };
        }
    }

    // Actualizar PIN de administrador
    async updateAdminPin(newPin) {
        try {
            if (!/^\d{4}$/.test(newPin)) {
                return { success: false, error: 'PIN debe ser de 4 dígitos numéricos' };
            }
            this.adminPin = await hashPin(newPin);
            await this.save();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Configuración
    getSettings() {
        return this.settings;
    }

    async updateSettings(newSettings) {
        try {
            this.settings = { ...this.settings, ...newSettings };
            await this.save();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // --- Gestión de Tickets ---
    async saveTicket(ticket) {
        try {
            // Validar ticket
            if (!ticket.numeroMesa || !ticket.meseroId || !ticket.items || ticket.items.length === 0) {
                return { success: false, error: 'Datos de ticket incompletos' };
            }

            // Buscar ticket activo existente para la misma mesa
            const existingTicketIndex = this.data.tickets.findIndex(t =>
                t.numero_mesa === parseInt(ticket.numeroMesa) && t.estado === 'activo'
            );

            if (existingTicketIndex !== -1) {
                // Actualizar ticket existente
                const existingTicket = this.data.tickets[existingTicketIndex];

                // Agregar nuevos items
                existingTicket.items = [...existingTicket.items, ...ticket.items];

                // Recalcular total
                existingTicket.total = existingTicket.items.reduce((sum, item) =>
                    sum + (item.precio * item.cantidad), 0);

                // Actualizar fecha y mesero (el último que modificó)
                existingTicket.fecha = new Date().toISOString();
                existingTicket.mesero_id = parseInt(ticket.meseroId);
                existingTicket.mesero_nombre = ticket.meseroNombre;

                await this.save();
                return { success: true, id: existingTicket.id, ticket: existingTicket };
            } else {
                // Crear nuevo ticket
                const newTicket = {
                    id: this.nextIds.tickets++,
                    numero_mesa: parseInt(ticket.numeroMesa),
                    mesero_id: parseInt(ticket.meseroId),
                    mesero_nombre: ticket.meseroNombre,
                    items: ticket.items,
                    total: parseFloat(ticket.total),
                    estado: 'activo', // activo, pagado, cancelado
                    fecha: new Date().toISOString()
                };
                this.data.tickets.push(newTicket);
                await this.save();
                return { success: true, id: newTicket.id, ticket: newTicket };
            }
        } catch (error) {
            console.error('Error guardando ticket:', error);
            return { success: false, error: error.message };
        }
    }

    // Obtener tickets activos
    getTicketsActivos() {
        return this.data.tickets
            .filter(t => t.estado === 'activo')
            .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    }

    // Obtener todos los tickets (con paginación opcional)
    getAllTickets(limit = null, offset = 0) {
        const sorted = this.data.tickets.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        if (limit !== null) {
            const start = offset;
            const end = offset + limit;
            return {
                tickets: sorted.slice(start, end),
                total: sorted.length
            };
        }
        return sorted;
    }

    // Obtener tickets por mesero
    getTicketsByMesero(meseroId) {
        return this.data.tickets
            .filter(t => t.mesero_id === parseInt(meseroId))
            .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    }

    // Actualizar estado de ticket
    async updateTicketEstado(ticketId, estado) {
        try {
            const ticket = this.data.tickets.find(t => t.id === parseInt(ticketId));
            if (!ticket) {
                return { success: false, error: 'Ticket no encontrado' };
            }
            ticket.estado = estado;
            if (estado === 'pagado') {
                ticket.fecha_pago = new Date().toISOString();
            }
            await this.save();
            return { success: true, ticket };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Obtener reporte de ventas por mesero
    getReporteVentasMesero(meseroId, fechaInicio, fechaFin) {
        const inicio = fechaInicio ? new Date(fechaInicio) : new Date(0);
        const fin = fechaFin ? new Date(fechaFin) : new Date();

        const tickets = this.data.tickets.filter(t => {
            const ticketFecha = new Date(t.fecha);
            return t.mesero_id === parseInt(meseroId) &&
                t.estado === 'pagado' &&
                ticketFecha >= inicio &&
                ticketFecha <= fin;
        });

        const totalVentas = tickets.reduce((sum, t) => sum + t.total, 0);
        const numeroTickets = tickets.length;
        const ticketPromedio = numeroTickets > 0 ? totalVentas / numeroTickets : 0;

        return {
            mesero_id: meseroId,
            mesero_nombre: tickets[0]?.mesero_nombre || '',
            total_ventas: totalVentas,
            numero_tickets: numeroTickets,
            ticket_promedio: ticketPromedio,
            tickets: tickets
        };
    }

    // Obtener estadísticas para Dashboard
    getDashboardStats() {
        if (this.statsCache.dashboard) {
            return this.statsCache.dashboard;
        }

        const ticketsPagados = this.data.tickets.filter(t => t.estado === 'pagado');
        // ... (rest of logic) ...

        // 1. Contar productos vendidos por categoría
        const itemCounts = {
            tacos: {},
            bebidas: {},
            extras: {}
        };

        ticketsPagados.forEach(ticket => {
            ticket.items.forEach(item => {
                const tipo = item.tipo || this.inferProductType(item.nombre);

                if (!itemCounts[tipo]) itemCounts[tipo] = {};
                if (!itemCounts[tipo][item.nombre]) itemCounts[tipo][item.nombre] = 0;
                itemCounts[tipo][item.nombre] += item.cantidad;
            });
        });

        // Helper para ordenar y tomar top 3
        const getTop3 = (counts) => {
            return Object.entries(counts)
                .map(([nombre, cantidad]) => ({ nombre, cantidad }))
                .sort((a, b) => b.cantidad - a.cantidad)
                .slice(0, 3);
        };

        const topTacos = getTop3(itemCounts.tacos);
        const topBebidas = getTop3(itemCounts.bebidas);
        const topExtras = getTop3(itemCounts.extras);

        // 2. Mejor Mesero (por ventas totales)
        const ventasMeseros = {};
        ticketsPagados.forEach(t => {
            if (!ventasMeseros[t.mesero_id]) {
                ventasMeseros[t.mesero_id] = { nombre: t.mesero_nombre, total: 0, tickets: 0 };
            }
            ventasMeseros[t.mesero_id].total += t.total;
            ventasMeseros[t.mesero_id].tickets++;
        });

        const mejorMesero = Object.values(ventasMeseros)
            .sort((a, b) => b.total - a.total)[0] || null;

        const stats = {
            topTacos,
            topBebidas,
            topExtras,
            mejorMesero
        };

        this.statsCache.dashboard = stats;
        return stats;
    }

    // Obtener estadísticas completas para Admin
    getAdminStats() {
        if (this.statsCache.admin) {
            return this.statsCache.admin;
        }

        const ticketsPagados = this.data.tickets.filter(t => t.estado === 'pagado');
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        // 1. Ventas últimos 7 días
        const salesLast7Days = {};
        for (let i = 0; i < 7; i++) {
            const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
            const dateStr = d.toISOString().split('T')[0];
            salesLast7Days[dateStr] = 0;
        }

        ticketsPagados.forEach(t => {
            const tDate = new Date(t.fecha);
            if (tDate >= sevenDaysAgo) {
                const dateStr = t.fecha.split('T')[0];
                if (salesLast7Days[dateStr] !== undefined) {
                    salesLast7Days[dateStr] += t.total;
                }
            }
        });

        // 2. Distribución y Top por Categoría
        const categorySales = { tacos: 0, bebidas: 0, extras: 0 };
        const tacosSales = {};
        const bebidasSales = {};
        const extrasSales = {};

        ticketsPagados.forEach(t => {
            t.items.forEach(item => {
                const tipo = item.tipo || this.inferProductType(item.nombre);
                const subtotal = item.precio * item.cantidad;

                if (categorySales[tipo] !== undefined) {
                    categorySales[tipo] += subtotal;
                }

                if (tipo === 'tacos') {
                    if (!tacosSales[item.nombre]) tacosSales[item.nombre] = 0;
                    tacosSales[item.nombre] += item.cantidad;
                } else if (tipo === 'bebidas') {
                    if (!bebidasSales[item.nombre]) bebidasSales[item.nombre] = 0;
                    bebidasSales[item.nombre] += item.cantidad;
                } else if (tipo === 'extras') {
                    if (!extrasSales[item.nombre]) extrasSales[item.nombre] = 0;
                    extrasSales[item.nombre] += item.cantidad;
                }
            });
        });

        const getTop5 = (salesObj) => {
            return Object.entries(salesObj)
                .map(([name, count]) => ({ name, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 5);
        };

        // 4. Rendimiento Meseros
        const waiterPerformance = {};
        ticketsPagados.forEach(t => {
            if (!waiterPerformance[t.mesero_nombre]) {
                waiterPerformance[t.mesero_nombre] = 0;
            }
            waiterPerformance[t.mesero_nombre] += t.total;
        });

        const stats = {
            salesHistory: Object.entries(salesLast7Days)
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([date, total]) => ({ date, total })),
            categoryDistribution: categorySales,
            topTacos: getTop5(tacosSales),
            topBebidas: getTop5(bebidasSales),
            topExtras: getTop5(extrasSales),
            waiterStats: Object.entries(waiterPerformance)
                .map(([name, total]) => ({ name, total }))
                .sort((a, b) => b.total - a.total)
        };

        this.statsCache.admin = stats;
        return stats;
    }

    // Obtener reporte de ventas del día
    getReporteVentasDia(fecha) {
        const fechaBusqueda = fecha ? new Date(fecha) : new Date();
        const inicioDia = new Date(fechaBusqueda);
        inicioDia.setHours(0, 0, 0, 0);
        const finDia = new Date(fechaBusqueda);
        finDia.setHours(23, 59, 59, 999);

        const tickets = this.data.tickets.filter(t => {
            const ticketFecha = new Date(t.fecha);
            return t.estado === 'pagado' &&
                ticketFecha >= inicioDia &&
                ticketFecha <= finDia;
        });

        const totalVentas = tickets.reduce((sum, t) => sum + t.total, 0);
        const numeroTickets = tickets.length;

        // Agrupar por mesero
        const ventasPorMesero = {};
        tickets.forEach(t => {
            if (!ventasPorMesero[t.mesero_id]) {
                ventasPorMesero[t.mesero_id] = {
                    mesero_nombre: t.mesero_nombre,
                    total: 0,
                    tickets: 0
                };
            }
            ventasPorMesero[t.mesero_id].total += t.total;
            ventasPorMesero[t.mesero_id].tickets++;
        });

        return {
            fecha: fechaBusqueda.toISOString(),
            total_ventas: totalVentas,
            numero_tickets: numeroTickets,
            ventas_por_mesero: ventasPorMesero,
            tickets: tickets
        };
    }

    // =====================================================
    // GESTIÓN DE TICKETS ABIERTOS
    // =====================================================

    // Marcar item como entregado
    async markItemDelivered(ticketId, itemIndex) {
        try {
            const ticket = this.data.tickets.find(t => t.id === parseInt(ticketId));
            if (!ticket) {
                return { success: false, error: 'Ticket no encontrado' };
            }

            if (!ticket.items || !ticket.items[itemIndex]) {
                return { success: false, error: 'Item no encontrado' };
            }

            ticket.items[itemIndex].entregado = true;
            await this.save();
            return { success: true, ticket };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Cerrar ticket (marcar como completado)
    async closeTicket(ticketId) {
        try {
            const ticket = this.data.tickets.find(t => t.id === parseInt(ticketId));
            if (!ticket) {
                return { success: false, error: 'Ticket no encontrado' };
            }

            ticket.estado = 'cerrado';
            ticket.cerrado = true;
            ticket.fecha_cierre = new Date().toISOString();

            // Marcar todos los items como entregados
            if (ticket.items) {
                ticket.items.forEach(item => item.entregado = true);
            }

            await this.save();
            return { success: true, ticket };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Agregar más items a un ticket existente
    async addItemsToTicket(ticketId, newItems) {
        try {
            const ticket = this.data.tickets.find(t => t.id === parseInt(ticketId));
            if (!ticket) {
                return { success: false, error: 'Ticket no encontrado' };
            }

            // Marcar items existentes como entregados antes de agregar nuevos
            if (ticket.items) {
                ticket.items.forEach(item => item.entregado = true);
            }

            // Agregar nuevos items (sin marcar como entregados)
            const itemsConEstado = newItems.map(item => ({
                ...item,
                entregado: false,
                agregado_en: new Date().toISOString()
            }));

            ticket.items = [...(ticket.items || []), ...itemsConEstado];

            // Recalcular total
            ticket.total = ticket.items.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);

            await this.save();
            return { success: true, ticket };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async close() {
        await this.save();
    }
}

module.exports = DatabaseManager;
