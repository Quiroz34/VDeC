const path = require('path');
const fs = require('fs');
const { app } = require('electron');
const { hashPin, verifyPin, isHashed } = require('./security');

class DatabaseManager {
    constructor(customPath = null) {
        this.dbPath = customPath || path.join(app.getPath('userData'), 'restaurante.json');
        console.log('!!! DATABASE PATH (VERIFY THIS):', this.dbPath);

        this.data = {
            productos: [],
            bebidas: [],
            extras: [],
            meseros: [],
            administradores: [],
            tickets: []
        };
        this.nextIds = {
            productos: 1,
            bebidas: 1,
            extras: 1,
            meseros: 1,
            administradores: 1,
            tickets: 1
        };
        this.adminPin = null; // Deprecated, kept for migration check
        this.settings = {
            restaurantName: 'TAQUERÍA EL SABOR',
            address: 'Dirección no configurada',
            contactInfo: '', // Nuevo: Teléfono / Contacto
            thankYouMessage: '¡Gracias por su preferencia!',
            footerMessage: '', // Nuevo: Mensaje Extra (Wifi, etc)
            enableTip: true
        };
        this.statsCache = {
            dashboard: null,
            admin: null
        };
        this.saveTimeout = null;
        this.isDirty = false;

        // Configuración de RED
        this.isClientMode = false;
        this.serverUrl = null;
        this.loadNetworkConfig();
    }

    loadNetworkConfig() {
        const configPath = path.join(app.getPath('userData'), 'network_config.json');
        if (fs.existsSync(configPath)) {
            try {
                const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                if (config.mode === 'client' && config.serverIp) {
                    this.isClientMode = true;
                    this.serverUrl = `http://${config.serverIp}:3000`;
                    console.log(`MODO CLIENTE ACTIVADO: Conectando a ${this.serverUrl}`);
                }
            } catch (e) {
                console.error('Error cargando config de red:', e);
            }
        }
    }

    async initDatabase() {
        // Cargar base de datos existente o crear una nueva
        if (fs.existsSync(this.dbPath)) {
            try {
                const fileData = fs.readFileSync(this.dbPath, 'utf8');
                const loaded = JSON.parse(fileData);
                this.data = loaded.data || this.data;
                this.nextIds = loaded.nextIds || this.nextIds;
                this.adminPin = loaded.adminPin; // Load legacy pin
                this.settings = loaded.settings || this.settings;

                console.log('✅ Database loaded successfully');
                console.log('📦 Productos:', this.data.productos?.length || 0);
                console.log('🥤 Bebidas:', this.data.bebidas?.length || 0);
                console.log('🍟 Extras:', this.data.extras?.length || 0);

                // Ensure administradores array exists
                if (!this.data.administradores) {
                    this.data.administradores = [];
                    this.nextIds.administradores = 1;
                }

                // Migrar PINs si no están hasheados y migrar Admin único a lista
                await this.migrateData();
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

    async insertSampleData() {
        console.log('Inserting sample data...');
        // Productos Base
        this.data.productos = [
            { id: 1, nombre: 'Taco de Asada', precio: 25, descripcion: 'Carne asada' },
            { id: 2, nombre: 'Taco de Pastor', precio: 25, descripcion: 'Pastor' }
        ];
        this.data.bebidas = [
            { id: 1, nombre: 'Coca-Cola', precio: 20, tamano: '355ml' },
            { id: 2, nombre: 'Agua Natural', precio: 15, tamano: '600ml' }
        ];
        this.data.extras = [
            { id: 1, nombre: 'Guacamole', precio: 15 }
        ];

        // Admin default
        const hash = await hashPin('1234');
        this.data.administradores = [{
            id: 1,
            nombre: 'Admin Principal',
            pin: hash,
            esPrincipal: true
        }];

        this.nextIds = {
            productos: 3,
            bebidas: 3,
            extras: 2,
            meseros: 1,
            administradores: 2,
            tickets: 1
        };

        this.isDirty = true;
    }

    async migrateData() {
        let needsSave = false;

        // 1. Migrar Admin Único -> Array de Administradores
        if (!this.data.administradores || this.data.administradores.length === 0) {
            console.log('Migrando administrador único a sistema multi-admin...');
            let initialPin = this.adminPin;

            // Si no hay PIN antiguo, usar default 1234
            if (!initialPin) {
                initialPin = await hashPin('1234');
            } else if (!isHashed(initialPin)) {
                initialPin = await hashPin(initialPin);
            }

            this.data.administradores = [{
                id: this.nextIds.administradores++,
                nombre: 'Administrador Principal',
                pin: initialPin,
                esPrincipal: true // Flag para evitar borrar el último
            }];
            this.adminPin = null; // Clear legacy
            needsSave = true;
        }

        // 2. Migrar Meseros (Hashes)
        if (this.data.meseros) {
            for (let mesero of this.data.meseros) {
                if (mesero.pin && !isHashed(mesero.pin)) {
                    mesero.pin = await hashPin(mesero.pin);
                    needsSave = true;
                }
            }
        }

        if (needsSave) {
            await this._saveToDisk();
            console.log('Migración de datos completada');
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

    async validateAdminPin(pin) {
        try {
            const admins = this.data.administradores || [];
            if (admins.length === 0) return { success: false, error: 'No hay administradores configurados' };

            for (const admin of admins) {
                const match = await verifyPin(pin, admin.pin);
                if (match) {
                    return { success: true, admin: { id: admin.id, nombre: admin.nombre } };
                }
            }
            return { success: false, error: 'PIN de administrador incorrecto' };
        } catch (e) {
            console.error('Error validando PIN admin:', e);
            return { success: false, error: e.message };
        }
    }



    // Función helper para inferir tipo de producto
    inferProductType(nombre) {
        const esBebida = this.data.bebidas.some(b => b.nombre === nombre);
        const esExtra = this.data.extras.some(e => e.nombre === nombre);
        return esBebida ? 'bebidas' : (esExtra ? 'extras' : 'tacos');
    }

    // CRUD Administradores
    getAdministradores() {
        return (this.data.administradores || []).map(a => ({
            id: a.id,
            nombre: a.nombre,
            esPrincipal: !!a.esPrincipal
        })).sort((a, b) => a.nombre.localeCompare(b.nombre));
    }

    async addAdministrador(admin) {
        try {
            if (!admin.nombre || !admin.pin) throw new Error('Datos incompletos');
            if (!/^\d{4}$/.test(admin.pin)) throw new Error('PIN debe ser de 4 dígitos');

            const hashedPin = await hashPin(admin.pin);

            const newAdmin = {
                id: this.nextIds.administradores++,
                nombre: admin.nombre.trim(),
                pin: hashedPin,
                esPrincipal: false
            };

            if (!this.data.administradores) this.data.administradores = [];
            this.data.administradores.push(newAdmin);
            await this.save();
            return { success: true, id: newAdmin.id };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async updateAdministrador(id, admin) {
        try {
            const index = this.data.administradores.findIndex(a => a.id === parseInt(id));
            if (index === -1) return { success: false, error: 'Administrador no encontrado' };

            const currentAdmin = this.data.administradores[index];
            const updated = {
                ...currentAdmin,
                nombre: admin.nombre.trim()
            };

            if (admin.pin && admin.pin.trim() !== '') {
                if (!/^\d{4}$/.test(admin.pin)) throw new Error('PIN debe ser de 4 dígitos');
                updated.pin = await hashPin(admin.pin);
            }

            this.data.administradores[index] = updated;
            await this.save();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async deleteAdministrador(id) {
        try {
            const index = this.data.administradores.findIndex(a => a.id === parseInt(id));
            if (index === -1) return { success: false, error: 'Administrador no encontrado' };

            // Evitar borrar el último administrador
            if (this.data.administradores.length <= 1) {
                return { success: false, error: 'No puedes eliminar al último administrador' };
            }

            this.data.administradores.splice(index, 1);
            await this.save();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
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

    // Configuración
    getSettings() {
        return this.settings || {
            restaurantName: 'Mi Restaurante',
            address: '',
            thankYouMessage: '¡Gracias por su preferencia!',
            enableTip: true
        };
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
                if (ticket.solicitudNuevoProducto) existingTicket.solicitudNuevoProducto = ticket.solicitudNuevoProducto; // Update if present

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
                    fecha: new Date().toISOString(),
                    solicitudNuevoProducto: ticket.solicitudNuevoProducto || '' // Nuevo campo
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
    async getAllTickets(limit = null, offset = 0) {
        if (this.isClientMode && this.serverUrl) {
            try {
                // MODO CLIENTE: Pedir a servidor
                const fetch = require('electron-fetch').default || global.fetch;
                let url = `${this.serverUrl}/api/tickets`;
                if (limit !== null) url += `?limit=${limit}&offset=${offset}`;

                const response = await fetch(url);
                if (!response.ok) throw new Error('Error de red');
                return await response.json();
            } catch (e) {
                console.error('Error fetching remote tickets:', e);
                return []; // Fallback vacío o error
            }
        }

        // MODO LOCAL
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

    // Obtener tickets de un día específico
    getDailyTickets(dateStr) {
        // dateStr debe ser formato YYYY-MM-DD
        // Si no se provee, usar hoy
        const targetDate = dateStr ? new Date(dateStr) : new Date();
        const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
        const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

        return this.data.tickets
            .filter(t => {
                const ticketDate = new Date(t.fecha);
                return ticketDate >= startOfDay && ticketDate <= endOfDay;
            })
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

        const ticketsPagados = this.data.tickets.filter(t => t.estado === 'pagado' || t.estado === 'cerrado');
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

        const ticketsPagados = this.data.tickets.filter(t => t.estado === 'pagado' || t.estado === 'cerrado');
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
            return (t.estado === 'pagado' || t.estado === 'cerrado') &&
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


}

module.exports = DatabaseManager;
