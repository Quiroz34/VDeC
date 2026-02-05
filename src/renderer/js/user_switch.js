// =====================================================
// SECCIÓN: CAMBIO DE USUARIO (MESERO)
// =====================================================

function showChangeMesero() {
    const modal = document.getElementById('change-mesero-modal');
    const select = document.getElementById('new-mesero-select');

    // Limpiar select
    select.innerHTML = '<option value="">-- Seleccionar --</option>';

    // Poblar con meseros (excluyendo el actual si se desea, pero mostrar todos es mejor UX)
    meseros.forEach(m => {
        // No mostrar al usuario actual en la lista para evitar recargas innecesarias
        if (activeMesero && m.id === activeMesero.id) return;

        const option = document.createElement('option');
        option.value = m.id;
        option.textContent = m.nombre;
        select.appendChild(option);
    });

    document.getElementById('new-mesero-pin').value = '';
    document.getElementById('change-error-message').style.display = 'none';

    modal.style.display = 'flex';
}

function closeChangeMesero() {
    document.getElementById('change-mesero-modal').style.display = 'none';
}

async function confirmChangeMesero() {
    const select = document.getElementById('new-mesero-select');
    const pinInput = document.getElementById('new-mesero-pin');
    const errorMsg = document.getElementById('change-error-message');

    const meseroId = select.value;
    const pin = pinInput.value;

    if (!meseroId) {
        errorMsg.textContent = 'Selecciona un mesero';
        errorMsg.style.display = 'block';
        return;
    }

    if (!pin || pin.length !== 4) {
        errorMsg.textContent = 'PIN inválido (4 dígitos)';
        errorMsg.style.display = 'block';
        return;
    }

    try {
        const result = await window.api.validateMeseroPin(meseroId, pin);

        if (result.success) {
            // Actualizar sesión
            sessionStorage.setItem('activeMesero', JSON.stringify(result.mesero));

            // Cerrar modal
            closeChangeMesero();

            // Actualizar UI
            window.location.reload();
        } else {
            errorMsg.textContent = '⛔ PIN Incorrecto';
            errorMsg.style.display = 'block';
            pinInput.value = '';
        }
    } catch (error) {
        console.error('Error cambio de usuario:', error);
        errorMsg.textContent = 'Error del sistema';
        errorMsg.style.display = 'block';
    }
}
