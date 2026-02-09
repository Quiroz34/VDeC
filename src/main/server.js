const express = require('express');
const cors = require('cors');
const { ip } = require('address'); // We might need to find local IP, but for now just listening on 0.0.0.0 is enough.

function startServer(db, port = 3000) {
    const app = express();
    app.use(cors());
    app.use(express.json());

    // Middleware para loggear peticiones
    app.use((req, res, next) => {
        console.log(`[API] ${req.method} ${req.url}`);
        next();
    });

    // === ENDPOINTS DE TICKETS ===

    // Obtener tickets (historial)
    app.get('/api/tickets', async (req, res) => {
        try {
            // Permitir paginación si se envía ?limit=X&offset=Y
            const limit = req.query.limit ? parseInt(req.query.limit) : null;
            const offset = req.query.offset ? parseInt(req.query.offset) : 0;

            const tickets = await db.getAllTickets(limit, offset);
            res.json(tickets);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Obtener estadísticas (para dashboard)
    app.get('/api/stats/dashboard', (req, res) => {
        try {
            const stats = db.getDashboardStats();
            res.json(stats);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    app.get('/api/stats/admin', (req, res) => {
        try {
            const stats = db.getAdminStats();
            res.json(stats);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Obtener productos (para que el admin vea nombres correctos si hiciera falta)
    app.get('/api/productos', (req, res) => {
        try {
            res.json(db.data.productos);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    app.get('/api/meseros', (req, res) => {
        try {
            res.json(db.data.meseros);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // === ENDPOINTS DE ACCIÓN (SOLO LECTURA/IMPRESIÓN PARA ADMIN) ===
    // Nota: El usuario pidió que el admin pudiera ver tickets terminados.
    // Si quisiera reimprimir, el admin hará la impresión LOCALMENTE con los datos que recibe.
    // No necesitamos un endpoint de "imprimir en servidor" a menos que quiera impresión remota.

    // Iniciar servidor
    const server = app.listen(port, '0.0.0.0', () => {
        console.log(`Servidor POS escuchando en puerto ${port}`);
        require('dns').lookup(require('os').hostname(), function (err, add, fam) {
            console.log(`IP Local: ${add}`);
        });
    });

    return server;
}

module.exports = { startServer };
