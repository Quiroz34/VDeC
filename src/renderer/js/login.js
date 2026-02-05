// Estado
let meseros = [];

// Elementos DOM (se inicializarán cuando el DOM esté listo)
let loginForm;
let meseroSelect;
let pinInput;
let errorMessage;
let btnLogin;
let topTacosContainer;
let topBebidasContainer;
let topExtrasContainer;
let bestWaiterContainer;

// Inicializar
document.addEventListener('DOMContentLoaded', async () => {
    // Inicializar elementos DOM
    loginForm = document.getElementById('login-form');
    meseroSelect = document.getElementById('mesero-select');
    pinInput = document.getElementById('pin-input');
    errorMessage = document.getElementById('error-message');
    btnLogin = document.getElementById('btn-login');
    topTacosContainer = document.getElementById('top-tacos');
    topBebidasContainer = document.getElementById('top-bebidas');
    topExtrasContainer = document.getElementById('top-extras');
    bestWaiterContainer = document.getElementById('best-waiter-card');

    // Por seguridad, limpiar bandera admin al volver al login
    sessionStorage.removeItem('isAdminAuthenticated');
    sessionStorage.removeItem('activeMesero');

    try {
        await Promise.all([
            loadSettings(),
            loadMeseros(),
            loadDashboardStats()
        ]);
    } catch (error) {
        console.error('Error inicializando login:', error);
    }

    // Configurar event listeners
    setupEventListeners();
});

// Configurar event listeners
function setupEventListeners() {
    // Manejar Login
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const meseroId = meseroSelect.value;
        const pin = pinInput.value;

        // Validación de entrada
        if (!meseroId) {
            showError('Por favor selecciona un mesero');
            return;
        }

        if (!pin || !/^\d{4}$/.test(pin)) {
            showError('PIN debe ser de 4 dígitos numéricos');
            pinInput.value = '';
            pinInput.focus();
            return;
        }

        // UI Loading
        btnLogin.disabled = true;
        btnLogin.textContent = 'Validando...';

        try {
            const result = await window.api.validateMeseroPin(meseroId, pin);

            if (result.success) {
                // Guardar sesión de mesero (NO admin)
                sessionStorage.setItem('activeMesero', JSON.stringify(result.mesero));
                window.location.href = 'index.html';
            } else {
                showError(result.error || 'PIN incorrecto. Intenta de nuevo.');
                pinInput.value = '';
                pinInput.focus();
            }
        } catch (error) {
            console.error('Error validando PIN:', error);
            showError('Error de sistema. Intenta más tarde.');
        } finally {
            btnLogin.disabled = false;
            btnLogin.textContent = 'Iniciar Sesión';
        }
    });

    // Input validations
    pinInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/[^0-9]/g, '');
    });
}

// Cargar configuración global
async function loadSettings() {
    try {
        const settings = await window.api.getSettings();
        const display = document.querySelector('.login-header p');
        const displayId = document.getElementById('restaurant-name-login');
        if (settings.restaurantName) {
            if (display) display.textContent = settings.restaurantName;
            if (displayId) displayId.textContent = settings.restaurantName;
        }
    } catch (error) {
        console.error('Error al cargar configuración:', error);
    }
}

// Cargar meseros
async function loadMeseros() {
    try {
        meseros = await window.api.getMeseros();

        // Limpiar
        meseroSelect.innerHTML = '<option value="">-- Seleccionar --</option>';

        meseros.forEach(mesero => {
            const option = document.createElement('option');
            option.value = mesero.id;
            option.textContent = mesero.nombre;
            meseroSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error al cargar meseros:', error);
        showError('Error cargando lista de meseros');
    }
}

// Cargar Estadísticas
async function loadDashboardStats() {
    try {
        const stats = await window.api.getDashboardStats();

        renderTopList(stats.topTacos, topTacosContainer, '🌮');
        renderTopList(stats.topBebidas, topBebidasContainer, '🥤');
        renderTopList(stats.topExtras, topExtrasContainer, '🍟');
        renderBestWaiter(stats.mejorMesero);

    } catch (error) {
        console.error('Error al cargar estadísticas:', error);
    }
}

// Renderizar lista "Top 3"
function renderTopList(items, container, icon) {
    if (!items || items.length === 0) {
        container.innerHTML = '<p class="empty-stat">Sin datos aún</p>';
        return;
    }

    const html = items.map((item, index) => `
        <div class="stat-item rank-${index + 1}">
            <span class="rank">#${index + 1}</span>
            <span class="name">${icon} ${item.nombre}</span>
            <span class="count">${item.cantidad} vendidos</span>
        </div>
    `).join('');

    container.innerHTML = html;
}

// Renderizar Mejor Mesero
function renderBestWaiter(waiter) {
    if (!waiter) {
        bestWaiterContainer.querySelector('.waiter-name').textContent = '---';
        return;
    }

    bestWaiterContainer.querySelector('.waiter-name').textContent = waiter.nombre;

    // Ocultar estadísticas de ventas por privacidad
    const statsContainer = bestWaiterContainer.querySelector('.waiter-stats');
    if (statsContainer) {
        statsContainer.style.display = 'none';
    }
}

// Mostrar error
function showError(msg) {
    errorMessage.textContent = msg;
    errorMessage.classList.add('show');
    setTimeout(() => errorMessage.classList.remove('show'), 3000);
}
