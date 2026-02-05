const bcrypt = require('bcryptjs');

/**
 * Módulo de seguridad para manejo de PINs
 * Utiliza bcrypt para hashear y verificar PINs de forma segura
 */

const SALT_ROUNDS = 10;

/**
 * Hashea un PIN de forma segura
 * @param {string} pin - PIN en texto plano (4 dígitos)
 * @returns {Promise<string>} PIN hasheado
 */
async function hashPin(pin) {
    if (!pin || typeof pin !== 'string') {
        throw new Error('PIN inválido');
    }
    
    // Validar que sea un PIN de 4 dígitos
    if (!/^\d{4}$/.test(pin)) {
        throw new Error('PIN debe ser de 4 dígitos numéricos');
    }
    
    return await bcrypt.hash(pin, SALT_ROUNDS);
}

/**
 * Verifica un PIN contra su hash
 * @param {string} pin - PIN en texto plano
 * @param {string} hash - Hash almacenado
 * @returns {Promise<boolean>} true si el PIN es correcto
 */
async function verifyPin(pin, hash) {
    if (!pin || !hash) {
        return false;
    }
    
    try {
        return await bcrypt.compare(String(pin), hash);
    } catch (error) {
        console.error('Error verificando PIN:', error);
        return false;
    }
}

/**
 * Verifica si un string es un hash de bcrypt
 * @param {string} str - String a verificar
 * @returns {boolean} true si es un hash de bcrypt
 */
function isHashed(str) {
    if (!str || typeof str !== 'string') {
        return false;
    }
    // Los hashes de bcrypt comienzan con $2a$, $2b$ o $2y$
    return /^\$2[aby]\$/.test(str);
}

module.exports = {
    hashPin,
    verifyPin,
    isHashed
};
