const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const DatabaseManager = require('./database');

// Deshabilitar aceleración de hardware para evitar crashes en Windows
app.disableHardwareAcceleration();

let mainWindow;
let db;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/login.html'));

  // Abrir DevTools en modo desarrollo
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

const { startServer } = require('./server'); // Importar servidor

app.whenReady().then(async () => {
  // Inicializar base de datos (ahora es async)
  db = new DatabaseManager();
  await db.initDatabase();

  // Iniciar Servidor API (Solo si no estamos en modo cliente)
  const configPath = path.join(app.getPath('userData'), 'network_config.json');
  let shouldStartServer = true;

  if (require('fs').existsSync(configPath)) {
    try {
      const config = JSON.parse(require('fs').readFileSync(configPath, 'utf8'));
      if (config.mode === 'client') {
        shouldStartServer = false;
        console.log('Modo cliente detectado. No se iniciará el servidor API.');
      }
    } catch (err) {
      console.error('Error leyendo configuración de red:', err);
    }
  }

  if (shouldStartServer) {
    try {
      startServer(db);
      console.log('Servidor API iniciado correctamente');
    } catch (err) {
      console.error('Error al iniciar servidor API:', err);
    }
  }

  // Crear ventana
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// IPC Handler para configuración de red
ipcMain.handle('save-network-config', async (event, config) => {
  try {
    const configPath = path.join(app.getPath('userData'), 'network_config.json');
    require('fs').writeFileSync(configPath, JSON.stringify(config, null, 2));

    // Si cambiamos a modo servidor, iniciamos server si no estaba
    if (config.mode === 'server') {
      try {
        startServer(db);
      } catch (e) { }
    }

    return { success: true };
  } catch (error) {
    console.error('Error guardando config red:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-local-ip', () => {
  try {
    const address = require('address');
    return address.ip(); // Retorna IPv4 LAN (ej. 192.168.1.50)
  } catch (e) {
    return 'No detectada';
  }
});

ipcMain.handle('restart-app', () => {
  app.relaunch();
  app.exit(0);
});

app.on('window-all-closed', async () => {
  if (process.platform !== 'darwin') {
    if (db) await db.close();
    app.quit();
  }
});

// IPC Handlers para productos
ipcMain.handle('get-productos', async () => {
  try {
    return db.getProductos();
  } catch (error) {
    console.error('Error en get-productos:', error);
    return [];
  }
});

ipcMain.handle('add-producto', async (event, producto) => {
  try {
    return await db.addProducto(producto);
  } catch (error) {
    console.error('Error en add-producto:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('update-producto', async (event, id, producto) => {
  try {
    return await db.updateProducto(id, producto);
  } catch (error) {
    console.error('Error en update-producto:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-producto', async (event, id) => {
  try {
    return await db.deleteProducto(id);
  } catch (error) {
    console.error('Error en delete-producto:', error);
    return { success: false, error: error.message };
  }
});

// IPC Handlers para bebidas
ipcMain.handle('get-bebidas', async () => {
  try {
    return db.getBebidas();
  } catch (error) {
    console.error('Error en get-bebidas:', error);
    return [];
  }
});

ipcMain.handle('add-bebida', async (event, bebida) => {
  try {
    return await db.addBebida(bebida);
  } catch (error) {
    console.error('Error en add-bebida:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('update-bebida', async (event, id, bebida) => {
  try {
    return await db.updateBebida(id, bebida);
  } catch (error) {
    console.error('Error en update-bebida:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-bebida', async (event, id) => {
  try {
    return await db.deleteBebida(id);
  } catch (error) {
    console.error('Error en delete-bebida:', error);
    return { success: false, error: error.message };
  }
});

// IPC Handlers para extras
ipcMain.handle('get-extras', async () => {
  try {
    return db.getExtras();
  } catch (error) {
    console.error('Error en get-extras:', error);
    return [];
  }
});

ipcMain.handle('add-extra', async (event, extra) => {
  try {
    return await db.addExtra(extra);
  } catch (error) {
    console.error('Error en add-extra:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('update-extra', async (event, id, extra) => {
  try {
    return await db.updateExtra(id, extra);
  } catch (error) {
    console.error('Error en update-extra:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-extra', async (event, id) => {
  try {
    return await db.deleteExtra(id);
  } catch (error) {
    console.error('Error en delete-extra:', error);
    return { success: false, error: error.message };
  }
});

// IPC Handlers para meseros
ipcMain.handle('get-meseros', async () => {
  try {
    return db.getMeseros();
  } catch (error) {
    console.error('Error en get-meseros:', error);
    return [];
  }
});

ipcMain.handle('add-mesero', async (event, mesero) => {
  try {
    return await db.addMesero(mesero);
  } catch (error) {
    console.error('Error en add-mesero:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('update-mesero', async (event, id, mesero) => {
  try {
    return await db.updateMesero(id, mesero);
  } catch (error) {
    console.error('Error en update-mesero:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-mesero', async (event, id) => {
  try {
    return await db.deleteMesero(id);
  } catch (error) {
    console.error('Error en delete-mesero:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('validate-mesero-pin', async (event, meseroId, pin) => {
  try {
    return await db.validateMeseroPin(meseroId, pin);
  } catch (error) {
    console.error('Error en validate-mesero-pin:', error);
    return { success: false, error: 'Error de validación' };
  }
});

ipcMain.handle('validate-admin-pin', async (event, pin) => {
  try {
    return await db.validateAdminPin(pin);
  } catch (error) {
    console.error('Error en validate-admin-pin:', error);
    return { success: false, error: 'Error de validación' };
  }
});

// IPC Handlers para administradores
ipcMain.handle('get-administradores', async () => {
  try {
    return db.getAdministradores();
  } catch (error) {
    console.error('Error en get-administradores:', error);
    return [];
  }
});

ipcMain.handle('add-administrador', async (event, admin) => {
  try {
    return await db.addAdministrador(admin);
  } catch (error) {
    console.error('Error en add-administrador:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('update-administrador', async (event, id, admin) => {
  try {
    return await db.updateAdministrador(id, admin);
  } catch (error) {
    console.error('Error en update-administrador:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-administrador', async (event, id) => {
  try {
    return await db.deleteAdministrador(id);
  } catch (error) {
    console.error('Error en delete-administrador:', error);
    return { success: false, error: error.message };
  }
});



// IPC Handler para guardar ticket
ipcMain.handle('save-ticket', async (event, ticket) => {
  return await db.saveTicket(ticket);
});

// IPC Handlers para gestión de tickets
ipcMain.handle('get-tickets-activos', async () => {
  return await db.getTicketsActivos();
});

ipcMain.handle('get-all-tickets', async (event, limit = null, offset = 0) => {
  return await db.getAllTickets(limit, offset);
});

ipcMain.handle('get-tickets-by-mesero', async (event, meseroId) => {
  return await db.getTicketsByMesero(meseroId);
});

ipcMain.handle('get-daily-tickets', async (event, dateStr) => {
  return db.getDailyTickets(dateStr);
});

ipcMain.handle('update-ticket-estado', (event, ticketId, estado) => {
  return db.updateTicketEstado(ticketId, estado);
});

ipcMain.handle('get-reporte-mesero', (event, meseroId, fechaInicio, fechaFin) => {
  return db.getReporteVentasMesero(meseroId, fechaInicio, fechaFin);
});

ipcMain.handle('get-reporte-dia', (event, fecha) => {
  return db.getReporteVentasDia(fecha);
});

// IPC Handlers para configuración
ipcMain.handle('get-settings', () => {
  return db.getSettings();
});

ipcMain.handle('update-settings', (event, settings) => {
  return db.updateSettings(settings);
});

// IPC Handlers para estadísticas
ipcMain.handle('get-admin-stats', () => {
  return db.getAdminStats();
});


ipcMain.handle('get-dashboard-stats', () => {
  return db.getDashboardStats();
});

// IPC Handlers para tickets abiertos
ipcMain.handle('get-tickets', async () => {
  try {
    return db.getAllTickets();
  } catch (error) {
    console.error('Error en get-tickets:', error);
    return [];
  }
});

ipcMain.handle('mark-item-delivered', async (event, ticketId, itemIndex) => {
  try {
    return await db.markItemDelivered(ticketId, itemIndex);
  } catch (error) {
    console.error('Error en mark-item-delivered:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('close-ticket', async (event, ticketId) => {
  try {
    return await db.closeTicket(ticketId);
  } catch (error) {
    console.error('Error en close-ticket:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('add-items-to-ticket', async (event, ticketId, items) => {
  try {
    return await db.addItemsToTicket(ticketId, items);
  } catch (error) {
    console.error('Error en add-items-to-ticket:', error);
    return { success: false, error: error.message };
  }
});


// IPC Handler para imprimir ticket
ipcMain.handle('print-ticket', async (event, ticketData) => {
  const printWindow = new BrowserWindow({
    width: 300,
    height: 600,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Crear HTML del ticket
  const settings = db.getSettings();
  const ticketHTML = generateTicketHTML(ticketData, settings);

  await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(ticketHTML)}`);

  printWindow.webContents.on('did-finish-load', () => {
    printWindow.webContents.print({
      silent: false,
      printBackground: true,
      margins: {
        marginType: 'none'
      }
    }, (success, errorType) => {
      if (!success) {
        console.error('Error al imprimir:', errorType);
      }
      printWindow.close();
    });
  });
});

// Helper para sanitizar input (Prevenir XSS)
function escapeHtml(unsafe) {
  if (typeof unsafe !== 'string') return unsafe;
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function generateTicketHTML(data, settings) {
  const itemsHTML = data.items.map(item => `
    <tr>
      <td>${item.cantidad}x ${escapeHtml(item.nombre)}</td>
      <td>$${item.precio.toFixed(2)}</td>
      <td>$${item.subtotal.toFixed(2)}</td>
    </tr>
  `).join('');

  const tipSection = settings.enableTip ? `
    <div class="tip-section">
      <p>Propina sugerida (10%): $${(data.total * 0.10).toFixed(2)}</p>
      <div style="border-bottom: 1px solid #000; margin-top: 20px; width: 100%;"></div>
      <p style="text-align: center; margin-top: 5px;">Firma / Propina</p>
    </div>
  ` : '';

  const contactHTML = settings.contactInfo ? `<p>📞 ${escapeHtml(settings.contactInfo)}</p>` : '';
  const footerMsgHTML = settings.footerMessage ? `<p style="margin-top:10px; font-weight:bold;">${escapeHtml(settings.footerMessage)}</p>` : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Courier New', monospace;
          width: 80mm;
          padding: 10px;
          font-size: 12px;
        }
        .header {
          text-align: center;
          margin-bottom: 15px;
          border-bottom: 2px dashed #000;
          padding-bottom: 10px;
        }
        .header h1 {
          font-size: 18px;
          margin-bottom: 5px;
        }
        .info {
          margin-bottom: 15px;
          border-bottom: 1px dashed #000;
          padding-bottom: 10px;
        }
        .info p {
          margin: 3px 0;
        }
        table {
          width: 100%;
          margin-bottom: 15px;
          border-collapse: collapse;
        }
        th {
          text-align: left;
          border-bottom: 1px solid #000;
          padding: 5px 0;
        }
        td {
          padding: 5px 0;
        }
        .total {
          border-top: 2px solid #000;
          padding-top: 10px;
          font-size: 16px;
          font-weight: bold;
          text-align: right;
        }
        .footer {
          text-align: center;
          margin-top: 20px;
          border-top: 1px dashed #000;
          padding-top: 10px;
        }
        .tip-section {
          margin-top: 15px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${escapeHtml(settings.restaurantName)}</h1>
        <p>${escapeHtml(settings.address)}</p>
        ${contactHTML}
      </div>
      
      <div class="info">
        <p><strong>Mesa:</strong> ${data.numeroMesa}</p>
        <p><strong>Mesero:</strong> ${escapeHtml(data.meseroNombre)}</p>
        <p><strong>Fecha:</strong> ${new Date().toLocaleString('es-MX')}</p>
      </div>
      
      <table>
        <thead>
          <tr>
            <th>Producto</th>
            <th>Precio</th>
            <th>Subtotal</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHTML}
        </tbody>
      </table>
      
      <div class="total">
        TOTAL: $${data.total.toFixed(2)}
      </div>

      ${tipSection}
      
      <div class="footer">
        <p>${escapeHtml(settings.thankYouMessage)}</p>
        ${footerMsgHTML}
      </div>
    </body>
    </html>
  `;
}
