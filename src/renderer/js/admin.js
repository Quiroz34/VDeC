// Estado de la aplicación
let currentTab = 'daily-tickets';
let productos = [];
let bebidas = [];
let extras = [];
let meseros = [];
let administradores = [];
let editingId = null;
let charts = {}; // Store chart instances
let refreshInterval = null; // Auto-refresh for daily tickets

// Inicializar aplicación
document.addEventListener('DOMContentLoaded', async () => {
    // Protección de acceso administrativo
    if (sessionStorage.getItem('isAdminAuthenticated') !== 'true') {
        window.location.href = 'index.html';
        return;
    }

    await loadData();
    showTab('daily-tickets'); // Default tab
    setupEventListeners();
});



// Cargar datos desde la base de datos
async function loadData() {
    try {
        productos = await window.api.getProductos();
        bebidas = await window.api.getBebidas();
        extras = await window.api.getExtras();
        meseros = await window.api.getMeseros();
        administradores = await window.api.getAdministradores(); // Nuevo w/ IPC
    } catch (error) {
        console.error('Error al cargar datos:', error);
        showNotification('Error al cargar los datos de la base de datos', 'error');
    }
}

// Configurar event listeners
function setupEventListeners() {
    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            showTab(btn.dataset.tab);
        });
    });

    // Back Button - Clear Session
    const btnBack = document.querySelector('.btn-back');
    if (btnBack) {
        btnBack.onclick = (e) => {
            e.preventDefault();
            sessionStorage.removeItem('isAdminAuthenticated'); // Enforce PIN on next entry
            window.location.href = 'index.html';
        };
    }

    // Form submit
    document.getElementById('product-form').addEventListener('submit', handleSubmit);

    // Cancel edit
    document.getElementById('btn-cancel').addEventListener('click', cancelEdit);

    // Save settings (Explicit binding)
    const btnSave = document.querySelector('button[onclick="saveSettings()"]');
    if (btnSave) {
        btnSave.removeAttribute('onclick');
        btnSave.addEventListener('click', saveSettings);
    }
}

// Cargar configuración
async function loadSettings() {
    try {
        const settings = await window.api.getSettings();
        if (settings) {
            const nameEl = document.getElementById('setting-name');
            const addressEl = document.getElementById('setting-address');
            const messageEl = document.getElementById('setting-message');
            const tipEl = document.getElementById('setting-tip');

            if (nameEl) nameEl.value = settings.restaurantName || '';
            if (addressEl) addressEl.value = settings.address || '';
            if (messageEl) messageEl.value = settings.thankYouMessage || '';
            if (tipEl) tipEl.checked = settings.enableTip !== false;
        }
    } catch (error) {
        console.error('Error al cargar configuración:', error);
        // Don't show error notification on page load, only log it
    }
}

// ... (Rest of code)


// Función para cambiar de pestaña
function showTab(tabId) {
    // Update active class
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    currentTab = tabId;

    // Clear any existing refresh interval
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
    }

    // Load data specific to the tab
    if (tabId === 'settings') {
        loadSettings();
    } else if (tabId === 'daily-tickets') {
        loadDailyTickets();
        // Auto-refresh every 10 seconds
        refreshInterval = setInterval(() => {
            if (currentTab === 'daily-tickets') {
                loadDailyTickets();
            }
        }, 10000);
    }

    renderProducts();
    updateFormFields();
}

// Cargar y renderizar estadísticas
async function loadAndRenderStats() {
    try {
        const stats = await window.api.getAdminStats();

        // Destroy existing charts to avoid overlap
        Object.values(charts).forEach(chart => chart.destroy());

        // Palette
        const palette = [
            '#FF6B35', '#F7931E', '#FDC830', '#004E89', '#1A659E',
            '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'
        ];

        // 1. Sales Chart (Line) - Mantener gradiente simple
        const ctxSales = document.getElementById('salesChart').getContext('2d');
        const gradient = ctxSales.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, 'rgba(255, 107, 53, 0.4)');
        gradient.addColorStop(1, 'rgba(255, 107, 53, 0.0)');

        charts.sales = new Chart(ctxSales, {
            type: 'line',
            data: {
                labels: stats.salesHistory.map(d => d.date),
                datasets: [{
                    label: 'Ventas ($)',
                    data: stats.salesHistory.map(d => d.total),
                    borderColor: '#FF6B35',
                    backgroundColor: gradient,
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: '#F7931E',
                    pointRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                return 'Ventas: $' + context.parsed.y.toFixed(2);
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function (value) {
                                return '$' + value.toFixed(0);
                            }
                        }
                    }
                }
            }
        });

        // 2. Top Tacos (Bar)
        const ctxTacos = document.getElementById('tacosChart').getContext('2d');
        charts.tacos = new Chart(ctxTacos, {
            type: 'bar',
            data: {
                labels: stats.topTacos.map(p => p.name),
                datasets: [{
                    label: 'Cantidad Vendida',
                    data: stats.topTacos.map(p => p.count),
                    backgroundColor: stats.topTacos.map((_, i) => palette[i % palette.length]),
                    borderWidth: 0
                }]
            },
            options: {
                indexAxis: 'y',
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    title: { display: false }
                },
                scales: {
                    x: {
                        ticks: {
                            stepSize: 1,
                            callback: function (value) {
                                return Number.isInteger(value) ? value : '';
                            }
                        }
                    }
                }
            }
        });

        // 3. Top Bebidas (Bar)
        const ctxBebidas = document.getElementById('bebidasChart').getContext('2d');
        charts.bebidas = new Chart(ctxBebidas, {
            type: 'bar',
            data: {
                labels: stats.topBebidas.map(p => p.name),
                datasets: [{
                    label: 'Cantidad Vendida',
                    data: stats.topBebidas.map(p => p.count),
                    backgroundColor: stats.topBebidas.map((_, i) => palette[(i + 2) % palette.length]),
                    borderWidth: 0
                }]
            },
            options: {
                indexAxis: 'y',
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    title: { display: false }
                },
                scales: {
                    x: {
                        ticks: {
                            stepSize: 1,
                            callback: function (value) {
                                return Number.isInteger(value) ? value : '';
                            }
                        }
                    }
                }
            }
        });

        // 4. Top Extras (Bar)
        const ctxExtras = document.getElementById('extrasChart').getContext('2d');
        charts.extras = new Chart(ctxExtras, {
            type: 'bar',
            data: {
                labels: stats.topExtras.map(p => p.name),
                datasets: [{
                    label: 'Cantidad Vendida',
                    data: stats.topExtras.map(p => p.count),
                    backgroundColor: stats.topExtras.map((_, i) => palette[(i + 4) % palette.length]),
                    borderWidth: 0
                }]
            },
            options: {
                indexAxis: 'y',
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    title: { display: false }
                },
                scales: {
                    x: {
                        ticks: {
                            stepSize: 1,
                            callback: function (value) {
                                return Number.isInteger(value) ? value : '';
                            }
                        }
                    }
                }
            }
        });

        // 5. Waiter Performance (Bar)
        const ctxWaiter = document.getElementById('waiterChart').getContext('2d');
        charts.waiter = new Chart(ctxWaiter, {
            type: 'bar',
            data: {
                labels: stats.waiterStats.map(w => w.name),
                datasets: [{
                    label: 'Ventas Totales ($)',
                    data: stats.waiterStats.map(w => w.total),
                    backgroundColor: stats.waiterStats.map((_, i) => palette[(i + 6) % palette.length]), // Offset colors
                    borderWidth: 0
                }]
            },
            options: {
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    title: { display: true, text: 'Rendimiento por Mesero' },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                return 'Total: $' + context.parsed.y.toFixed(2);
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function (value) {
                                return '$' + value.toFixed(0);
                            }
                        }
                    }
                }
            }
        });

    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Actualizar campos del formulario según la pestaña
function updateFormFields() {
    const formTitle = document.getElementById('form-title');
    const listTitle = document.getElementById('list-title');
    const descripcionGroup = document.getElementById('descripcion-group');
    const tamanoGroup = document.getElementById('tamano-group');
    const pinGroup = document.getElementById('pin-group');
    const precioGroup = document.getElementById('precio').parentElement; // form-group

    // Sections
    const productsSection = document.getElementById('products-table');
    const statsSection = document.getElementById('stats-section');
    const dailyTicketsSection = document.getElementById('daily-tickets-section');
    const addForm = document.querySelector('.add-form');

    // Default visibility
    const inputPrecio = document.getElementById('precio');
    precioGroup.style.display = 'block';
    inputPrecio.required = true; // Ensure required by default

    productsSection.style.display = 'grid'; // or block based on css
    statsSection.style.display = 'none';
    dailyTicketsSection.style.display = 'none';
    addForm.style.display = 'block';

    if (currentTab === 'stats') {
        formTitle.textContent = 'Estadísticas del Restaurante';
        listTitle.style.display = 'none';
        addForm.style.display = 'none';
        productsSection.style.display = 'none';
        statsSection.style.display = 'block';
        document.getElementById('settings-section').style.display = 'none';
        loadAndRenderStats();
        return;
    } else if (currentTab === 'settings') {
        formTitle.textContent = 'Configuración del Ticket';
        listTitle.style.display = 'none';
        addForm.style.display = 'none';
        productsSection.style.display = 'none';
        statsSection.style.display = 'none';
        dailyTicketsSection.style.display = 'none';
        document.getElementById('settings-section').style.display = 'block';
        loadSettings();
        return;
    } else if (currentTab === 'daily-tickets') {
        formTitle.textContent = 'Tickets del Día';
        listTitle.style.display = 'none';
        addForm.style.display = 'none';
        productsSection.style.display = 'none';
        statsSection.style.display = 'none';
        document.getElementById('settings-section').style.display = 'none';
        dailyTicketsSection.style.display = 'block';
        loadDailyTickets();
        return;
    } else {
        listTitle.style.display = 'block';
        document.getElementById('settings-section').style.display = 'none';
        dailyTicketsSection.style.display = 'none';
    }

    switch (currentTab) {
        case 'productos':
            formTitle.textContent = 'Agregar Nuevo Taco';
            listTitle.textContent = 'Lista de Tacos';
            descripcionGroup.style.display = 'block';
            tamanoGroup.style.display = 'none';
            pinGroup.style.display = 'none';
            break;
        case 'bebidas':
            formTitle.textContent = 'Agregar Nueva Bebida';
            listTitle.textContent = 'Lista de Bebidas';
            descripcionGroup.style.display = 'none';
            tamanoGroup.style.display = 'block';
            pinGroup.style.display = 'none';
            break;
        case 'extras':
            formTitle.textContent = 'Agregar Nuevo Extra';
            listTitle.textContent = 'Lista de Extras';
            descripcionGroup.style.display = 'none';
            tamanoGroup.style.display = 'none';
            pinGroup.style.display = 'none';
            break;
        case 'meseros':
            formTitle.textContent = 'Agregar Nuevo Mesero';
            listTitle.textContent = 'Lista de Meseros';
            descripcionGroup.style.display = 'none';
            tamanoGroup.style.display = 'none';
            pinGroup.style.display = 'block';
            precioGroup.style.display = 'none';
            inputPrecio.required = false; // Disable required for waiters
            break;
        case 'administradores':
            formTitle.textContent = 'Agregar Nuevo Administrador';
            listTitle.textContent = 'Lista de Administradores';
            descripcionGroup.style.display = 'none';
            tamanoGroup.style.display = 'none';
            pinGroup.style.display = 'block';
            precioGroup.style.display = 'none';
            inputPrecio.required = false;
            break;
    }
}

// Manejar envío del formulario
async function handleSubmit(e) {
    e.preventDefault();

    const nombre = document.getElementById('nombre').value.trim();
    let precio = 0;

    if (currentTab !== 'meseros') {
        const precioVal = document.getElementById('precio').value;
        precio = parseFloat(precioVal);

        if (!nombre || precioVal === '' || isNaN(precio)) {
            showNotification('Por favor completa todos los campos requeridos', 'error');
            return;
        }
    } else {
        if (!nombre) {
            showNotification('Por favor ingresa el nombre del mesero', 'error');
            return;
        }
    }

    try {
        if (editingId) {
            // Actualizar existente
            switch (currentTab) {
                case 'productos':
                    const descripcion = document.getElementById('descripcion').value.trim();
                    await window.api.updateProducto(editingId, { nombre, precio, descripcion });
                    productos = await window.api.getProductos();
                    break;
                case 'bebidas':
                    const tamano = document.getElementById('tamano').value.trim();
                    await window.api.updateBebida(editingId, { nombre, precio, tamano });
                    bebidas = await window.api.getBebidas();
                    break;
                case 'extras':
                    await window.api.updateExtra(editingId, { nombre, precio });
                    extras = await window.api.getExtras();
                    break;
                case 'meseros':
                    const pin = document.getElementById('pin').value.trim();
                    await window.api.updateMesero(editingId, { nombre, pin });
                    meseros = await window.api.getMeseros();
                    break;
            }
            showNotification('Elemento actualizado correctamente', 'success');
        } else {
            // Crear nuevo
            switch (currentTab) {
                case 'productos':
                    const descripcion = document.getElementById('descripcion').value.trim();
                    await window.api.addProducto({ nombre, precio, descripcion });
                    productos = await window.api.getProductos();
                    break;
                case 'bebidas':
                    const tamano = document.getElementById('tamano').value.trim();
                    await window.api.addBebida({ nombre, precio, tamano });
                    bebidas = await window.api.getBebidas();
                    break;
                case 'extras':
                    await window.api.addExtra({ nombre, precio });
                    extras = await window.api.getExtras();
                    break;
                case 'meseros':
                    const pin = document.getElementById('pin').value.trim();
                    await window.api.addMesero({ nombre, pin: pin || '1234' });
                    meseros = await window.api.getMeseros();
                    break;
            }
            showNotification('Elemento agregado correctamente', 'success');
        }

        // Limpiar formulario y resetear estado
        cancelEdit();

        // Actualizar lista
        renderProducts();
    } catch (error) {
        console.error('Error al guardar:', error);
        showNotification('Error al guardar el elemento', 'error');
    }
}

// Renderizar productos
function renderProducts() {
    const container = document.getElementById('products-table');
    container.innerHTML = '';

    let items = [];
    switch (currentTab) {
        case 'productos':
            items = productos;
            break;
        case 'bebidas':
            items = bebidas;
            break;
        case 'extras':
            items = extras;
            break;
        case 'meseros':
            items = meseros;
            break;
        case 'administradores':
            items = administradores;
            break;
    }

    if (!items || items.length === 0) {
        container.innerHTML = '<p class="empty-message">No hay productos registrados</p>';
        return;
    }

    items.forEach(item => {
        const row = createProductRow(item);
        container.appendChild(row);
    });
}

// Crear fila de producto
function createProductRow(item) {
    const div = document.createElement('div');
    div.className = 'product-row';

    let details = '';
    let priceDisplay = `$${item.precio ? item.precio.toFixed(2) : '0.00'}`;

    if (currentTab === 'productos' && item.descripcion) {
        details = `<p>${item.descripcion}</p>`;
    } else if (currentTab === 'bebidas' && item.tamano) {
        details = `<p>Tamaño: ${item.tamano}</p>`;
    } else if (currentTab === 'meseros') {
        details = `<p>PIN: <strong>****</strong></p>`; // Ocultar PIN por seguridad
        priceDisplay = ''; // No mostrar precio para meseros
    } else if (currentTab === 'administradores') {
        const principalBadge = item.esPrincipal ? '<span class="badge badge-success" style="font-size: 0.7rem; margin-left: 5px;">Principal</span>' : '';
        details = `<p>PIN: <strong>****</strong></p>`;
        priceDisplay = principalBadge;
    }

    div.innerHTML = `
<div class="product-info">
<h3>${item.nombre}</h3>
${details}
<div class="product-price">${priceDisplay}</div>
</div>
<div class="product-actions">
<button class="btn-edit" onclick="editProduct(${item.id})">✏️ Editar</button>
<button class="btn-delete" onclick="deleteProduct(${item.id})">🗑️ Eliminar</button>
</div>
`;

    return div;
}

// Editar producto
function editProduct(id) {
    let item;
    switch (currentTab) {
        case 'productos':
            item = productos.find(p => p.id === id);
            break;
        case 'bebidas':
            item = bebidas.find(b => b.id === id);
            break;
        case 'extras':
            item = extras.find(e => e.id === id);
            break;
        case 'meseros':
            item = meseros.find(m => m.id === id);
            break;
    }

    if (!item) return;

    editingId = id;

    // Llenar formulario
    document.getElementById('nombre').value = item.nombre;

    if (currentTab !== 'meseros') {
        document.getElementById('precio').value = item.precio;
    }

    if (currentTab === 'productos') {
        document.getElementById('descripcion').value = item.descripcion || '';
    } else if (currentTab === 'bebidas') {
        document.getElementById('tamano').value = item.tamano || '';
    } else if (currentTab === 'meseros') {
        document.getElementById('pin').value = item.pin || '';
    } else if (currentTab === 'administradores') {
        document.getElementById('pin').value = ''; // Always clear PIN for admins when editing, require re-entry or leave blank to keep
        document.getElementById('pin').placeholder = 'Dejar vacío para mantener actual';
    }

    // Actualizar UI
    document.querySelector('.btn-add').textContent = '💾 Guardar Cambios';
    document.getElementById('form-title').textContent = `Editar ${currentTab.slice(0, -1)}`;
    document.getElementById('btn-cancel').style.display = 'inline-block';

    // Scroll al formulario
    document.querySelector('.add-form').scrollIntoView({ behavior: 'smooth' });
}

// Cancelar edición
function cancelEdit() {
    editingId = null;
    document.getElementById('product-form').reset();
    document.querySelector('.btn-add').textContent = '➕ Agregar';
    document.getElementById('btn-cancel').style.display = 'none';

    // Restaurar títulos
    updateFormFields();
}

// Eliminar producto
async function deleteProduct(id) {
    if (!await showConfirm('¿Estás seguro de eliminar este elemento?')) {
        return;
    }

    try {
        switch (currentTab) {
            case 'productos':
                await window.api.deleteProducto(id);
                productos = await window.api.getProductos();
                break;
            case 'bebidas':
                await window.api.deleteBebida(id);
                bebidas = await window.api.getBebidas();
                break;
            case 'extras':
                await window.api.deleteExtra(id);
                extras = await window.api.getExtras();
                break;
            case 'meseros':
                await window.api.deleteMesero(id);
                meseros = await window.api.getMeseros();
                break;
            case 'administradores':
                await window.api.deleteAdministrador(id);
                administradores = await window.api.getAdministradores();
                break;
        }

        renderProducts();
        showNotification('Elemento eliminado correctamente', 'success');
    } catch (error) {
        console.error('Error al eliminar:', error);
        showNotification('Error al eliminar el elemento', 'error');
    }
}

// Cargar configuración de la base de datos
async function loadSettings() {
    try {
        const settings = await window.api.getSettings();

        // Actualizar UI dinámica
        const display = document.getElementById('restaurant-name-display');
        if (display && settings.restaurantName) {
            display.textContent = `⚙️ ${settings.restaurantName}`;
        }

        document.getElementById('setting-name').value = settings.restaurantName || '';
        document.getElementById('setting-address').value = settings.address || '';
        document.getElementById('setting-message').value = settings.thankYouMessage || '';
        document.getElementById('setting-tip').checked = settings.enableTip !== false;
    } catch (error) {
        console.error('Error al cargar configuración:', error);
        showNotification('Error al cargar la configuración', 'error');
    }
}

// Guardar configuración
async function saveSettings() {
    const newSettings = {
        restaurantName: document.getElementById('setting-name').value.trim(),
        address: document.getElementById('setting-address').value.trim(),
        thankYouMessage: document.getElementById('setting-message').value.trim(),
        enableTip: document.getElementById('setting-tip').checked
    };

    if (!newSettings.restaurantName) {
        showNotification('El nombre del restaurante es obligatorio', 'error');
        return;
    }

    try {
        await window.api.updateSettings(newSettings);
        showNotification('Configuración guardada correctamente', 'success');
    } catch (error) {
        console.error('Error al guardar configuración:', error);
        showNotification('Error al guardar la configuración', 'error');
    }
}

// Cargar tickets del día
async function loadDailyTickets() {
    try {
        const tickets = await window.api.getDailyTickets(); // Sin argumento = hoy
        renderDailyTickets(tickets);
    } catch (error) {
        console.error('Error al cargar tickets del día:', error);
        showNotification('Error al cargar los tickets', 'error');
    }
}

// Renderizar tabla de tickets
function renderDailyTickets(tickets) {
    const tbody = document.getElementById('daily-tickets-body');
    tbody.innerHTML = '';

    if (!tickets || tickets.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px;">No hay tickets registrados hoy</td></tr>';
        return;
    }

    tickets.forEach(ticket => {
        const tr = document.createElement('tr');

        // Formatear hora
        const fecha = new Date(ticket.fecha);
        const hora = fecha.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

        // Estado con badges
        let badgeClass = 'badge-default';
        if (ticket.estado === 'pagado') badgeClass = 'badge-success';
        else if (ticket.estado === 'cancelado') badgeClass = 'badge-danger';
        else if (ticket.estado === 'activo') badgeClass = 'badge-active';

        // Solicitud special formatting
        const solicitudHtml = ticket.solicitudNuevoProducto
            ? `<span style="color: var(--primary); font-weight: bold;">📝 ${ticket.solicitudNuevoProducto}</span>`
            : '<span style="color: #666;">-</span>';

        tr.innerHTML = `
            <td>#${ticket.id}</td>
            <td>${hora}</td>
            <td>${ticket.mesero_nombre || 'N/A'}</td>
            <td>${ticket.numero_mesa || 'N/A'}</td>
            <td>$${ticket.total.toFixed(2)}</td>
            <td>${solicitudHtml}</td>
            <td><span class="badge ${badgeClass}">${ticket.estado.toUpperCase()}</span></td>
            <td>
                <button class="btn-action" onclick="openTicketModal(${ticket.id})">👁️ Ver / 🖨️</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Global para el ticket actual en el modal
let currentModalTicket = null;

// Abrir modal de ticket
function openTicketModal(ticketId) {
    window.api.getDailyTickets().then(tickets => {
        const ticket = tickets.find(t => t.id === ticketId);
        if (!ticket) return;

        currentModalTicket = ticket;

        document.getElementById('modal-ticket-id').textContent = ticket.id;
        document.getElementById('modal-ticket-mesero').textContent = ticket.mesero_nombre || 'N/A';
        document.getElementById('modal-ticket-mesa').textContent = ticket.numero_mesa || 'N/A';

        const fecha = new Date(ticket.fecha);
        document.getElementById('modal-ticket-hora').textContent = fecha.toLocaleTimeString('es-MX');

        document.getElementById('modal-ticket-total').textContent = ticket.total.toFixed(2);

        const tbody = document.getElementById('modal-ticket-items');
        tbody.innerHTML = '';

        ticket.items.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.cantidad}</td>
                <td>${item.nombre}</td>
                <td>$${item.precio.toFixed(2)}</td>
                <td>$${(item.precio * item.cantidad).toFixed(2)}</td>
            `;
            tbody.appendChild(tr);
        });

        document.getElementById('ticket-modal').style.display = 'flex';
    });
}

function closeTicketModal() {
    document.getElementById('ticket-modal').style.display = 'none';
    currentModalTicket = null;
}

// Imprimir ticket actual
async function printCurrentTicket() {
    if (!currentModalTicket) return;
    try {
        await window.api.printTicket(currentModalTicket);
    } catch (error) {
        console.error('Error al imprimir:', error);
        showNotification('Error al enviar la impresión', 'error');
    }
}

// --- Custom Alerts System ---
let confirmResolver = null;

function showNotification(message, type = 'info') {
    const modal = document.getElementById('alert-modal');
    const title = document.getElementById('alert-title');
    const msg = document.getElementById('alert-message');
    const icon = document.getElementById('alert-icon');
    const content = modal.querySelector('.modal-content');

    msg.textContent = message;

    if (type === 'error') {
        title.textContent = 'Error';
        title.style.color = '#f87171'; // red
        icon.textContent = '❌';
        content.style.borderColor = 'var(--danger)';
    } else if (type === 'success') {
        title.textContent = 'Éxito';
        title.style.color = '#4ade80'; // green
        icon.textContent = '✅';
        content.style.borderColor = 'var(--success)';
    } else {
        title.textContent = 'Aviso';
        title.style.color = 'var(--white)';
        icon.textContent = '⚠️';
        content.style.borderColor = 'var(--primary)';
    }

    modal.style.display = 'flex';
}

function closeAlertModal() {
    document.getElementById('alert-modal').style.display = 'none';
}

function showConfirm(message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirm-modal');
        document.getElementById('confirm-message').textContent = message;
        modal.style.display = 'flex';
        confirmResolver = resolve;
    });
}

function resolveConfirm(result) {
    document.getElementById('confirm-modal').style.display = 'none';
    if (confirmResolver) {
        confirmResolver(result);
        confirmResolver = null;
    }
}
