/**
 * Utilidades compartidas para el frontend
 */

/**
 * Verifica si existe una sesión activa
 * @returns {Object|null} Datos del mesero activo o null
 */
function checkActiveSession() {
    const meseroData = sessionStorage.getItem('activeMesero');
    if (!meseroData) {
        return null;
    }

    try {
        return JSON.parse(meseroData);
    } catch (error) {
        console.error('Error parseando sesión:', error);
        sessionStorage.removeItem('activeMesero');
        return null;
    }
}

/**
 * Verifica si el usuario tiene autenticación de administrador
 * @returns {boolean}
 */
function isAdminAuthenticated() {
    return sessionStorage.getItem('isAdminAuthenticated') === 'true';
}

/**
 * Limpia toda la sesión
 */
function clearSession() {
    sessionStorage.removeItem('activeMesero');
    sessionStorage.removeItem('isAdminAuthenticated');
}

/**
 * Redirige a login si no hay sesión activa
 * @param {boolean} requireAdmin - Si requiere autenticación de admin
 */
function requireAuth(requireAdmin = false) {
    const session = checkActiveSession();

    if (!session) {
        window.location.href = 'login.html';
        return false;
    }

    if (requireAdmin && !isAdminAuthenticated()) {
        window.location.href = 'login.html';
        return false;
    }

    return true;
}

/**
 * Formatea un número como moneda mexicana
 * @param {number} amount - Cantidad a formatear
 * @returns {string} Cantidad formateada
 */
function formatCurrency(amount) {
    if (typeof amount !== 'number' || isNaN(amount)) {
        return '$0.00';
    }
    return `$${amount.toFixed(2)}`;
}

/**
 * Formatea una fecha en formato legible
 * @param {string|Date} date - Fecha a formatear
 * @returns {string} Fecha formateada
 */
function formatDate(date) {
    try {
        const d = new Date(date);
        if (isNaN(d.getTime())) {
            return 'Fecha inválida';
        }
        return d.toLocaleString('es-MX', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (error) {
        console.error('Error formateando fecha:', error);
        return 'Fecha inválida';
    }
}

/**
 * Valida que un PIN sea de 4 dígitos numéricos
 * @param {string} pin - PIN a validar
 * @returns {boolean}
 */
function isValidPin(pin) {
    return /^\d{4}$/.test(pin);
}

/**
 * Valida que un número de mesa sea válido
 * @param {number|string} mesa - Número de mesa
 * @returns {boolean}
 */
function isValidMesa(mesa) {
    const num = parseInt(mesa);
    return !isNaN(num) && num > 0;
}

/**
 * Muestra un mensaje de error temporal
 * @param {HTMLElement} element - Elemento donde mostrar el error
 * @param {string} message - Mensaje de error
 * @param {number} duration - Duración en ms (default 3000)
 */
function showError(element, message, duration = 3000) {
    if (!element) return;

    element.textContent = message;
    element.style.display = 'block';
    element.classList.add('show');

    setTimeout(() => {
        element.classList.remove('show');
        setTimeout(() => {
            element.style.display = 'none';
        }, 300);
    }, duration);
}

/**
 * Maneja errores de forma consistente
 * @param {Error} error - Error a manejar
 * @param {string} context - Contexto del error
 */
function handleError(error, context = '') {
    console.error(`Error ${context}:`, error);

    // Aquí se podría agregar logging a servidor o mostrar notificación al usuario
    const message = error.message || 'Error desconocido';
    alert(`Error ${context}: ${message}`);
}

/**
 * Calcula el tiempo transcurrido desde una fecha
 * @param {string|Date} fecha - Fecha de inicio
 * @returns {string} Tiempo transcurrido en formato legible
 */
function getTimeElapsed(fecha) {
    try {
        const inicio = new Date(fecha);
        if (isNaN(inicio.getTime())) {
            return 'Fecha inválida';
        }

        const ahora = new Date();
        const diff = ahora - inicio;

        const minutos = Math.floor(diff / 60000);
        const horas = Math.floor(minutos / 60);
        const dias = Math.floor(horas / 24);

        if (dias > 0) return `${dias}d ${horas % 24}h`;
        if (horas > 0) return `${horas}h ${minutos % 60}m`;
        return `${minutos}m`;
    } catch (error) {
        console.error('Error calculando tiempo:', error);
        return 'Error';
    }
}

// Exportar funciones para uso en otros módulos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        checkActiveSession,
        isAdminAuthenticated,
        clearSession,
        requireAuth,
        formatCurrency,
        formatDate,
        isValidPin,
        isValidMesa,
        showError,
        handleError,
        getTimeElapsed
    };
}
