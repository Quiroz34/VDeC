const { contextBridge, ipcRenderer } = require('electron');

// Exponer APIs seguras al renderer process
contextBridge.exposeInMainWorld('api', {
    // Estadísticas
    getDashboardStats: () => ipcRenderer.invoke('get-dashboard-stats'),
    getAdminStats: () => ipcRenderer.invoke('get-admin-stats'),
    // Productos
    getProductos: () => ipcRenderer.invoke('get-productos'),
    getBebidas: () => ipcRenderer.invoke('get-bebidas'),
    getExtras: () => ipcRenderer.invoke('get-extras'),

    // CRUD Productos
    addProducto: (producto) => ipcRenderer.invoke('add-producto', producto),
    updateProducto: (id, producto) => ipcRenderer.invoke('update-producto', id, producto),
    deleteProducto: (id) => ipcRenderer.invoke('delete-producto', id),

    // CRUD Bebidas
    addBebida: (bebida) => ipcRenderer.invoke('add-bebida', bebida),
    updateBebida: (id, bebida) => ipcRenderer.invoke('update-bebida', id, bebida),
    deleteBebida: (id) => ipcRenderer.invoke('delete-bebida', id),

    // CRUD Extras
    addExtra: (extra) => ipcRenderer.invoke('add-extra', extra),
    updateExtra: (id, extra) => ipcRenderer.invoke('update-extra', id, extra),
    deleteExtra: (id) => ipcRenderer.invoke('delete-extra', id),

    // Meseros
    getMeseros: () => ipcRenderer.invoke('get-meseros'),
    addMesero: (mesero) => ipcRenderer.invoke('add-mesero', mesero),
    updateMesero: (id, mesero) => ipcRenderer.invoke('update-mesero', id, mesero),
    deleteMesero: (id) => ipcRenderer.invoke('delete-mesero', id),
    validateMeseroPin: (meseroId, pin) => ipcRenderer.invoke('validate-mesero-pin', meseroId, pin),
    validateAdminPin: (pin) => ipcRenderer.invoke('validate-admin-pin', pin),
    updateAdminPin: (newPin) => ipcRenderer.invoke('update-admin-pin', newPin),

    // Configuración
    getSettings: () => ipcRenderer.invoke('get-settings'),
    updateSettings: (settings) => ipcRenderer.invoke('update-settings', settings),

    // Tickets
    saveTicket: (ticket) => ipcRenderer.invoke('save-ticket', ticket),
    getTickets: () => ipcRenderer.invoke('get-tickets'),
    getTicketsActivos: () => ipcRenderer.invoke('get-tickets-activos'),
    getAllTickets: () => ipcRenderer.invoke('get-all-tickets'),
    getTicketsByMesero: (meseroId) => ipcRenderer.invoke('get-tickets-by-mesero', meseroId),
    updateTicketEstado: (ticketId, estado) => ipcRenderer.invoke('update-ticket-estado', ticketId, estado),
    getReporteMesero: (meseroId, fechaInicio, fechaFin) => ipcRenderer.invoke('get-reporte-mesero', meseroId, fechaInicio, fechaFin),
    getReporteDia: (fecha) => ipcRenderer.invoke('get-reporte-dia', fecha),
    markItemDelivered: (ticketId, itemIndex) => ipcRenderer.invoke('mark-item-delivered', ticketId, itemIndex),
    closeTicket: (ticketId) => ipcRenderer.invoke('close-ticket', ticketId),
    addItemsToTicket: (ticketId, items) => ipcRenderer.invoke('add-items-to-ticket', ticketId, items),

    // Impresión
    printTicket: (ticketData) => ipcRenderer.invoke('print-ticket', ticketData)
});
