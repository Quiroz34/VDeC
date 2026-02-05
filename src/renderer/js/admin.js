// Estado de la aplicación
let currentTab = 'productos';
let productos = [];
let bebidas = [];
let extras = [];
let meseros = [];
let editingId = null;
let charts = {}; // Store chart instances

// Inicializar aplicación
document.addEventListener('DOMContentLoaded', async () => {
    // Protección de acceso administrativo
    if (sessionStorage.getItem('isAdminAuthenticated') !== 'true') {
        window.location.href = 'index.html';
        return;
    }

    await loadData();
    await loadSettings();
    showTab('productos'); // Assuming showTab is a new or existing function to handle tab display
    setupEventListeners();
});



// Cargar datos desde la base de datos
async function loadData() {
    try {
        productos = await window.api.getProductos();
        bebidas = await window.api.getBebidas();
        extras = await window.api.getExtras();
        meseros = await window.api.getMeseros();
    } catch (error) {
        console.error('Error al cargar datos:', error);
        alert('Error al cargar los datos de la base de datos');
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

// ... (Rest of code)

// Guardar configuración
async function saveSettings() {
    const newSettings = {
        restaurantName: document.getElementById('setting-name').value.trim(),
        address: document.getElementById('setting-address').value.trim(),
        thankYouMessage: document.getElementById('setting-message').value.trim(),
        enableTip: document.getElementById('setting-tip').checked
    };

    const newPin = document.getElementById('setting-admin-pin').value.trim();

    if (!newSettings.restaurantName) {
        alert('El nombre del restaurante es obligatorio');
        return;
    }

    try {
        await window.api.updateSettings(newSettings);

        // Update PIN if provided
        if (newPin) {
            if (newPin.length !== 4 || !/^\d+$/.test(newPin)) {
                alert('El PIN debe ser de 4 dígitos numéricos');
                return;
            }
            await window.api.updateAdminPin(newPin);
        }

        alert('Configuración guardada correctamente');
        if (newPin) {
            document.getElementById('setting-admin-pin').value = ''; // Clear for security
        }
    } catch (error) {
        console.error('Error al guardar configuración:', error);
        alert('Error al guardar la configuración');
    }
}

// Función para cambiar de pestaña
function showTab(tabId) {
    // Update active class
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    currentTab = tabId;
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
            options: { responsive: true, plugins: { legend: { display: false } }, maintainAspectRatio: false }
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
                    title: { display: true, text: 'Rendimiento por Mesero' }
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
    const addForm = document.querySelector('.add-form');

    // Default visibility
    const inputPrecio = document.getElementById('precio');
    precioGroup.style.display = 'block';
    inputPrecio.required = true; // Ensure required by default

    productsSection.style.display = 'grid'; // or block based on css
    statsSection.style.display = 'none';
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
        document.getElementById('settings-section').style.display = 'block';
        loadSettings();
        return;
    } else {
        listTitle.style.display = 'block';
        document.getElementById('settings-section').style.display = 'none';
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
            alert('Por favor completa todos los campos requeridos');
            return;
        }
    } else {
        if (!nombre) {
            alert('Por favor ingresa el nombre del mesero');
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
            alert('Elemento actualizado correctamente');
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
            alert('Elemento agregado correctamente');
        }

        // Limpiar formulario y resetear estado
        cancelEdit();

        // Actualizar lista
        renderProducts();
    } catch (error) {
        console.error('Error al guardar:', error);
        alert('Error al guardar el elemento');
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
    }

    if (items.length === 0) {
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
    }

    div.innerHTML = `
    <div class="product-info">
      <h3>${item.nombre}</h3>
      ${details}
      <div class="product-price">${priceDisplay}</div>
    </div>
    <div class="product-actions">
      <button class="btn-edit" onclick="editItem(${item.id})">✏️ Editar</button>
      <button class="btn-delete" onclick="deleteProduct(${item.id})">🗑️ Eliminar</button>
    </div>
  `;

    return div;
}

// Eliminar producto
async function deleteProduct(id) {
    if (!confirm('¿Estás seguro de eliminar este elemento?')) {
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
        }

        renderProducts();
        alert('Elemento eliminado correctamente');
    } catch (error) {
        console.error('Error al eliminar:', error);
        alert('Error al eliminar el elemento');
    }
}

// Editar elemento
function editItem(id) {
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
    }

    // Actualizar UI
    document.querySelector('.btn-add').textContent = '💾 Guardar Cambios';
    document.getElementById('form-title').textContent = `Editar ${currentTab.slice(0, -1)}`; // "Editar producto", etc.
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

    // Restaurar título original
    updateFormFields();
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
        document.getElementById('setting-address').value = settings.address;
        document.getElementById('setting-message').value = settings.thankYouMessage;
        document.getElementById('setting-tip').checked = settings.enableTip;
    } catch (error) {
        console.error('Error al cargar configuración:', error);
        alert('Error al cargar la configuración');
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

    const newPin = document.getElementById('setting-admin-pin').value.trim();

    if (!newSettings.restaurantName) {
        alert('El nombre del restaurante es obligatorio');
        return;
    }

    try {
        await window.api.updateSettings(newSettings);

        // Update PIN if provided
        if (newPin) {
            if (newPin.length !== 4 || !/^\d+$/.test(newPin)) {
                alert('El PIN debe ser de 4 dígitos numéricos');
                return;
            }
            await window.api.updateAdminPin(newPin);
        }

        alert('Configuración guardada correctamente');
        if (newPin) document.getElementById('setting-admin-pin').value = '';
    } catch (error) {
        console.error('Error al guardar configuración:', error);
        alert('Error al guardar la configuración');
    }
}
