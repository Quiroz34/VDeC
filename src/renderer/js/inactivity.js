// Inactivity Timer - Refactored
let inactivityTimer;
let warningTimer;
let countdownInterval;

const TIMEOUT_MS = 300000; // 5 minutos totales
const WARNING_DURATION = 60000; // 60 segundos de advertencia
const IDLE_TIME = TIMEOUT_MS - WARNING_DURATION; // 4 minutos de inactividad antes del aviso

console.log('Inactivity timer initialized');

function resetTimer() {
    // Limpiar todos los timers
    clearTimeout(inactivityTimer);
    clearTimeout(warningTimer);
    clearInterval(countdownInterval);

    // Ocultar modal si está abierto
    const modal = document.getElementById('inactivity-modal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
    }

    // Si estamos en login, no hacemos nada
    if (window.location.href.includes('login.html')) return;

    // Timer para mostrar advertencia
    warningTimer = setTimeout(showWarning, IDLE_TIME);
}

function showWarning() {
    const modal = document.getElementById('inactivity-modal');

    // Si no existe el modal (ej. en otra página), redirigir directo
    if (!modal) {
        return logoutNow();
    }

    modal.style.display = 'flex';
    // Forzar reflow para animación si la hay
    void modal.offsetWidth;
    modal.classList.add('active');

    let secondsLeft = 60;
    const countdownDisplay = document.getElementById('inactivity-countdown');
    if (countdownDisplay) countdownDisplay.textContent = secondsLeft;

    // Actualizar cuenta regresiva visual
    countdownInterval = setInterval(() => {
        secondsLeft--;
        if (countdownDisplay) countdownDisplay.textContent = secondsLeft;

        if (secondsLeft <= 0) {
            clearInterval(countdownInterval);
            logoutNow();
        }
    }, 1000);
}

function stayActive() {
    resetTimer();
}

function logoutNow() {
    console.log('Session expired due to inactivity');
    sessionStorage.removeItem('activeMesero');
    sessionStorage.removeItem('isAdminAuthenticated');

    // Evitar loop de redirección
    if (!window.location.href.includes('login.html')) {
        window.location.href = 'login.html';
    }
}

// Eventos de actividad
const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];

events.forEach(event => {
    document.addEventListener(event, resetTimer, true);
});

// Inicializar
document.addEventListener('DOMContentLoaded', resetTimer);

// Exponer funciones globalmente para los botones del modal
window.stayActive = stayActive;
window.logoutNow = logoutNow;
