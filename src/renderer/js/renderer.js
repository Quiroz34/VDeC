// Estado de la aplicación
let currentTab = 'tacos';
let productos = [];
let bebidas = [];
let extras = [];
let meseros = [];
let cart = [];
let activeMesero = null;

// Inicializar aplicación
document.addEventListener('DOMContentLoaded', async () => {
    // BUG FIX: Asegurar que el input de mesa inicie editable
    const mesaInput = document.getElementById('mesa');
    if (mesaInput) {
        mesaInput.readOnly = false;
        mesaInput.style.background = '';
        mesaInput.style.cursor = '';
    }

    // Verificar sesión activa
    checkSession();

    await loadData();
    await loadSettings();
    setupEventListeners();
    renderProducts();
    displayActiveMesero();

    // Cargar tickets abiertos
    await refreshOpenTickets();
});

// Cargar configuración global
async function loadSettings() {
    try {
        const settings = await window.api.getSettings();
        const display = document.getElementById('restaurant-name-display');
        if (display && settings.restaurantName) {
            display.textContent = `🌮 ${settings.restaurantName}`;
        }
        return settings;
    } catch (error) {
        console.error('Error al cargar configuración:', error);
    }
}

// Verificar sesión activa
function checkSession() {
    const meseroData = sessionStorage.getItem('activeMesero');
    if (!meseroData) {
        // No hay sesión, redirigir a login
        window.location.href = 'login.html';
        return;
    }
    activeMesero = JSON.parse(meseroData);
}

// Mostrar mesero activo
function displayActiveMesero() {
    if (activeMesero) {
        document.getElementById('active-user-name').textContent = activeMesero.nombre;
    }
}

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
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentTab = btn.dataset.tab;
            renderProducts();
        });
    });

    // Botones de acción
    document.getElementById('btn-clear').addEventListener('click', clearCart);
    document.getElementById('btn-generate').addEventListener('click', initiateTicketGeneration);
}

// Renderizar productos según la pestaña activa
function renderProducts() {
    const container = document.getElementById('products-container');
    container.innerHTML = '';

    let items = [];
    switch (currentTab) {
        case 'tacos':
            items = productos;
            break;
        case 'bebidas':
            items = bebidas;
            break;
        case 'extras':
            items = extras;
            break;
    }

    const fragment = document.createDocumentFragment();
    items.forEach(item => {
        const card = createProductCard(item);
        fragment.appendChild(card);
    });
    container.appendChild(fragment);
}

// Crear tarjeta de producto
function createProductCard(item) {
    const card = document.createElement('div');
    card.className = 'product-card';

    let description = '';
    if (currentTab === 'tacos' && item.descripcion) {
        description = `<p>${item.descripcion}</p>`;
    } else if (currentTab === 'bebidas' && item.tamano) {
        description = `<p>${item.tamano}</p>`;
    }

    card.innerHTML = `
    <h3>${item.nombre}</h3>
    ${description}
    <div class="price">$${item.precio.toFixed(2)}</div>
  `;

    card.addEventListener('click', () => addToCart(item));

    return card;
}

// Agregar producto al carrito
function addToCart(item) {
    const existingItem = cart.find(cartItem =>
        cartItem.id === item.id && cartItem.tipo === currentTab
    );

    if (existingItem) {
        existingItem.cantidad++;
    } else {
        cart.push({
            id: item.id,
            tipo: currentTab,
            nombre: item.nombre,
            precio: item.precio,
            cantidad: 1
        });
    }

    renderCart();
    updateTotal();
}

// Renderizar carrito
function renderCart() {
    const itemsList = document.getElementById('items-list');

    if (cart.length === 0) {
        itemsList.innerHTML = '<p class="empty-message">No hay productos agregados</p>';
        return;
    }

    itemsList.innerHTML = '';
    const fragment = document.createDocumentFragment();
    cart.forEach((item, index) => {
        const itemElement = createCartItem(item, index);
        fragment.appendChild(itemElement);
    });
    itemsList.appendChild(fragment);
}

// Crear elemento del carrito
function createCartItem(item, index) {
    const div = document.createElement('div');
    div.className = 'ticket-item';

    const subtotal = item.precio * item.cantidad;

    div.innerHTML = `
    <div class="item-info">
      <div class="item-name">${item.nombre}</div>
      <div class="item-details">$${item.precio.toFixed(2)} × ${item.cantidad} = $${subtotal.toFixed(2)}</div>
    </div>
    <div class="item-actions">
      <div class="quantity-controls">
        <button class="quantity-btn" onclick="decreaseQuantity(${index})">−</button>
        <span class="quantity">${item.cantidad}</span>
        <button class="quantity-btn" onclick="increaseQuantity(${index})">+</button>
      </div>
      <button class="btn-remove" onclick="removeFromCart(${index})">🗑️</button>
    </div>
  `;

    return div;
}

// Aumentar cantidad
function increaseQuantity(index) {
    cart[index].cantidad++;
    renderCart();
    updateTotal();
}

// Disminuir cantidad
function decreaseQuantity(index) {
    if (cart[index].cantidad > 1) {
        cart[index].cantidad--;
        renderCart();
        updateTotal();
    }
}

// Eliminar del carrito
function removeFromCart(index) {
    cart.splice(index, 1);
    renderCart();
    updateTotal();
}

// Actualizar total
function updateTotal() {
    const total = cart.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
    document.getElementById('subtotal').textContent = `$${total.toFixed(2)}`;
    document.getElementById('total').textContent = `$${total.toFixed(2)}`;
}

// Limpiar carrito
function clearCart() {
    if (cart.length === 0) return;

    if (confirm('¿Deseas limpiar todos los productos del ticket?')) {
        cart = [];
        renderCart();
        updateTotal();
    }
}

// Variable global para almacenar datos del ticket temporal
let pendingTicketData = null;

// Imprimir ticket - ahora muestra vista previa primero
async function initiateTicketGeneration() {
    const mesa = document.getElementById('mesa').value;
    const isEditing = sessionStorage.getItem('addingToTicket');

    // Validar número de mesa (solo si no estamos editando)
    if (!isEditing) {
        if (!mesa || parseInt(mesa) <= 0) {
            alert('Por favor ingresa un número de mesa válido (mayor a 0)');
            document.getElementById('mesa').focus();
            return;
        }
    }

    // Validar que hay productos
    if (cart.length === 0) {
        alert('No hay productos en el ticket. Agrega al menos un producto.');
        return;
    }

    // Usar mesero activo de la sesión
    if (!activeMesero) {
        alert('Error: No hay mesero activo. Por favor inicia sesión nuevamente.');
        window.location.href = 'login.html';
        return;
    }

    pendingTicketData = {
        numeroMesa: parseInt(mesa),
        meseroId: activeMesero.id,
        meseroNombre: activeMesero.nombre,
        items: cart.map(item => ({
            nombre: item.nombre,
            precio: item.precio,
            cantidad: item.cantidad,
            tipo: item.tipo,
            subtotal: item.precio * item.cantidad
        })),
        total: cart.reduce((sum, item) => sum + (item.precio * item.cantidad), 0)
    };

    // Mostrar vista previa
    showPreview(pendingTicketData);
}

// Mostrar vista previa del ticket
async function showPreview(ticketData) {
    try {
        const settings = await window.api.getSettings();
        const previewDiv = document.getElementById('ticket-preview');
        const modal = document.getElementById('preview-modal');

        const itemsHTML = ticketData.items.map(item => `
            <tr>
                <td>${item.cantidad}x ${item.nombre}</td>
                <td>$${item.precio.toFixed(2)}</td>
                <td>$${item.subtotal.toFixed(2)}</td>
            </tr>
        `).join('');

        previewDiv.innerHTML = `
            <div class="preview-ticket">
                <div class="preview-header">
                    <h3>🌮 ${settings.restaurantName.toUpperCase()} 🌮</h3>
                    <p>${settings.address}</p>
                </div>
                
                <div class="preview-info">
                    <p><strong>Mesa:</strong> ${ticketData.numeroMesa}</p>
                    <p><strong>Mesero:</strong> ${ticketData.meseroNombre}</p>
                    <p><strong>Fecha:</strong> ${new Date().toLocaleString('es-MX')}</p>
                </div>
                
                <table class="preview-table">
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
                
                <div class="preview-total">
                    <strong>TOTAL: $${ticketData.total.toFixed(2)}</strong>
                </div>
                
                <div class="preview-footer">
                    <p>¡Gracias por su preferencia!</p>
                    <p>Vuelva pronto</p>
                </div>
            </div>
        `;

        modal.style.display = 'flex';
    } catch (error) {
        console.error('Error mostrando vista previa:', error);
        alert('Error al mostrar vista previa del ticket');
    }
}

// Cerrar vista previa
function closePreview() {
    const modal = document.getElementById('preview-modal');
    modal.style.display = 'none';
    pendingTicketData = null;

    // Si no se está editando, asegurar que el input de mesa quede limpio y editable
    const addingToTicket = sessionStorage.getItem('addingToTicket');
    if (!addingToTicket) {
        const mesaInput = document.getElementById('mesa');
        if (mesaInput) {
            mesaInput.value = '';
            mesaInput.readOnly = false;
            mesaInput.style.background = '';
            mesaInput.style.cursor = '';
        }
    }
}

// Confirmar y Generar (Sin imprimir)
async function confirmGenerate() {
    if (!pendingTicketData) {
        alert('No hay datos de ticket para imprimir');
        return;
    }

    try {
        // Verificar si estamos agregando a un ticket existente
        const addingToTicket = sessionStorage.getItem('addingToTicket');

        let result;
        if (addingToTicket) {
            // Agregar items al ticket existente
            result = await window.api.addItemsToTicket(parseInt(addingToTicket), pendingTicketData.items);

            if (result.success) {
                // Limpiar estado de edición
                sessionStorage.removeItem('addingToTicket');

                // Restaurar input de mesa
                const mesaInput = document.getElementById('mesa');
                mesaInput.readOnly = false;
                mesaInput.style.background = '';
                mesaInput.style.cursor = '';

                // Restaurar título
                const ticketHeader = document.querySelector('.ticket-section .ticket-header h2');
                if (ticketHeader) {
                    ticketHeader.innerHTML = '🆕 Nuevo Ticket';
                }

                // Remover botón de cancelar
                const cancelBtn = document.getElementById('btn-cancel-edit');
                if (cancelBtn) cancelBtn.remove();

                // Imprimir solo los nuevos items
                /* REMOVED: Printing is now manual
                await window.api.printTicket({
                    ...result.ticket,
                    items: pendingTicketData.items,
                    esAdicional: true
                });
                */
                alert(`Productos agregados al ticket #${addingToTicket}`);
            }
        } else {
            // Guardar nuevo ticket
            result = await window.api.saveTicket(pendingTicketData);

            if (result.success && result.ticket) {
                // Imprimir el ticket completo
                // await window.api.printTicket(result.ticket); // REMOVED: Printing is now manual
                alert('Ticket generado correctamente');
            }
        }

        if (result.success) {
            // Cerrar modal
            closePreview();

            // Limpiar formulario
            cart = [];
            document.getElementById('mesa').value = '';
            renderCart();
            updateTotal();

            // Actualizar lista de tickets abiertos
            await refreshOpenTickets();
        } else {
            throw new Error(result.error || 'No se pudo procesar el ticket');
        }
    } catch (error) {
        console.error('Error al imprimir ticket:', error);
        alert(`Error al imprimir el ticket: ${error.message}`);
    }
}

// Mostrar modal de cambio de mesero
async function showChangeMesero() {
    const modal = document.getElementById('change-mesero-modal');
    const select = document.getElementById('new-mesero-select');

    // Cargar meseros en el select
    select.innerHTML = '<option value="">-- Seleccionar --</option>';
    meseros.forEach(mesero => {
        const option = document.createElement('option');
        option.value = mesero.id;
        option.textContent = mesero.nombre;
        select.appendChild(option);
    });

    // Limpiar campos
    document.getElementById('new-mesero-pin').value = '';
    document.getElementById('change-error-message').style.display = 'none';

    modal.style.display = 'flex';
}

// Cerrar modal de cambio
function closeChangeMesero() {
    const modal = document.getElementById('change-mesero-modal');
    modal.style.display = 'none';
}

// Confirmar cambio de mesero
async function confirmChangeMesero() {
    const meseroId = document.getElementById('new-mesero-select').value;
    const pin = document.getElementById('new-mesero-pin').value;
    const errorMsg = document.getElementById('change-error-message');

    // Validar entrada
    if (!meseroId) {
        errorMsg.textContent = 'Por favor selecciona un mesero';
        errorMsg.style.display = 'block';
        return;
    }

    if (!pin || !/^\d{4}$/.test(pin)) {
        errorMsg.textContent = 'PIN debe ser de 4 dígitos numéricos';
        errorMsg.style.display = 'block';
        return;
    }

    try {
        const result = await window.api.validateMeseroPin(meseroId, pin);

        if (result.success) {
            // Actualizar sesión
            sessionStorage.setItem('activeMesero', JSON.stringify(result.mesero));

            // Recargar página para aplicar cambios
            window.location.reload();
        } else {
            // Mostrar error
            errorMsg.textContent = result.error || 'PIN incorrecto';
            errorMsg.style.display = 'block';
            document.getElementById('new-mesero-pin').value = '';

            setTimeout(() => {
                errorMsg.style.display = 'none';
            }, 3000);
        }
    } catch (error) {
        console.error('Error al cambiar mesero:', error);
        errorMsg.textContent = 'Error al validar. Intenta de nuevo.';
        errorMsg.style.display = 'block';
    }
}

// =====================================================
// SECCIÓN: TICKETS ABIERTOS
// =====================================================

// Cargar y mostrar tickets abiertos
async function refreshOpenTickets() {
    const container = document.getElementById('open-tickets-container');
    if (!container) return;

    try {
        const tickets = await window.api.getTickets();
        // Filtrar solo tickets abiertos (estado = 'abierto' o recientes del día)
        const today = new Date().toDateString();
        const openTickets = tickets.filter(t => {
            const ticketDate = new Date(t.fecha).toDateString();
            return t.estado === 'abierto' || (ticketDate === today && !t.cerrado);
        });

        if (openTickets.length === 0) {
            container.innerHTML = '<p class="empty-message" style="text-align: center; color: #666; padding: 20px;">No hay tickets abiertos</p>';
            return;
        }

        container.innerHTML = openTickets.map(ticket => renderOpenTicketCard(ticket)).join('');
    } catch (error) {
        console.error('Error cargando tickets abiertos:', error);
        container.innerHTML = '<p class="empty-message" style="text-align: center; color: #ef4444; padding: 20px;">Error al cargar tickets</p>';
    }
}

// Renderizar tarjeta de ticket abierto
function renderOpenTicketCard(ticket) {
    const ticketId = ticket.id || generateTicketId();
    const items = ticket.items || [];

    // Generar HTML de items con estado de entrega
    const itemsHtml = items.map((item, index) => {
        const isDelivered = item.entregado === true;
        const itemStyle = isDelivered
            ? 'background: rgba(34, 197, 94, 0.2); border-left: 4px solid #22c55e; color: #22c55e;'
            : 'background: rgba(249, 115, 22, 0.1); border-left: 4px solid #f97316;';

        return `
            <div class="open-ticket-item" style="padding: 8px 12px; margin: 4px 0; border-radius: 6px; ${itemStyle} display: flex; justify-content: space-between; align-items: center;">
                <span>${item.cantidad}x ${item.nombre}</span>
                <div style="display: flex; gap: 8px; align-items: center;">
                    <span style="font-size: 0.85rem;">$${(item.precio * item.cantidad).toFixed(2)}</span>
                    ${!isDelivered ? `
                        <button onclick="markItemDelivered(${ticket.id}, ${index})" 
                                style="background: #22c55e; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.75rem;"
                                title="Marcar como entregado">
                            ✓
                        </button>
                    ` : '<span style="font-size: 0.85rem;">✓ Entregado</span>'}
                </div>
            </div>
        `;
    }).join('');

    return `
        <div class="open-ticket-card" style="background: var(--bg-dark); border-radius: 12px; padding: 15px; margin-bottom: 12px; border: 1px solid rgba(255,255,255,0.1);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px;">
                <div>
                    <span style="font-weight: bold; color: var(--primary); font-size: 1.1rem;">🎫 #${ticketId}</span>
                    <span style="color: #94a3b8; font-size: 0.85rem; margin-left: 10px;">Mesa ${ticket.mesa}</span>
                </div>
                <span style="color: #94a3b8; font-size: 0.8rem;">${formatTime(ticket.fecha)}</span>
            </div>
            <div class="open-ticket-items" style="margin-bottom: 10px;">
                ${itemsHtml}
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.1);">
                <span style="font-weight: bold; color: white;">Total: $${ticket.total.toFixed(2)}</span>
                <div style="display: flex; gap: 8px;">
                    <button onclick="addMoreToTicket(${ticket.id}, ${ticket.mesa})" 
                            style="background: var(--primary); color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 0.85rem;">
                        ➕ Agregar
                    </button>
                    <button onclick="printTicketReceipt(${ticket.id})" 
                            style="background: #3b82f6; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 0.85rem;" title="Imprimir Ticket">
                        🖨️
                    </button>
                    <button onclick="closeTicket(${ticket.id})" 
                            style="background: #22c55e; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 0.85rem;">
                        ✓ Cerrar
                    </button>
                </div>
            </div>
        </div>
    `;
}

// Generar ID único para ticket
function generateTicketId() {
    return Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2, 4).toUpperCase();
}

// Formatear hora
function formatTime(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

// Marcar item como entregado
async function markItemDelivered(ticketId, itemIndex) {
    try {
        const result = await window.api.markItemDelivered(ticketId, itemIndex);
        if (result.success) {
            await refreshOpenTickets();
        } else {
            alert('Error al marcar item como entregado');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error de sistema');
    }
}

// Agregar más productos a un ticket existente
function addMoreToTicket(ticketId, mesa) {
    // Establecer la mesa del ticket (solo lectura)
    const mesaInput = document.getElementById('mesa');
    mesaInput.value = mesa;
    mesaInput.readOnly = true;
    mesaInput.style.background = '#374151';
    mesaInput.style.cursor = 'not-allowed';

    // Guardar el ticketId para cuando se imprima
    sessionStorage.setItem('addingToTicket', ticketId);

    // Cambiar título para indicar que se está editando
    const ticketHeader = document.querySelector('.ticket-section .ticket-header h2');
    if (ticketHeader) {
        ticketHeader.innerHTML = `📝 Agregando a Ticket #${ticketId}`;
    }

    // Agregar botón para cancelar edición
    const ticketActions = document.querySelector('.ticket-actions');
    if (ticketActions && !document.getElementById('btn-cancel-edit')) {
        const cancelBtn = document.createElement('button');
        cancelBtn.id = 'btn-cancel-edit';
        cancelBtn.className = 'btn btn-secondary';
        cancelBtn.innerHTML = '❌ Cancelar Edición';
        cancelBtn.onclick = cancelEditTicket;
        cancelBtn.style.marginRight = '10px';
        ticketActions.insertBefore(cancelBtn, ticketActions.firstChild);
    }

    // Scroll al panel de productos
    document.querySelector('.products-panel')?.scrollIntoView({ behavior: 'smooth' });

    alert(`Agrega productos al ticket #${ticketId} (Mesa ${mesa}). Luego presiona "Imprimir Ticket" para agregar los productos.`);
}

// Cancelar edición de ticket
function cancelEditTicket() {
    sessionStorage.removeItem('addingToTicket');

    // Restaurar input de mesa
    const mesaInput = document.getElementById('mesa');
    mesaInput.value = '';
    mesaInput.readOnly = false;
    mesaInput.style.background = '';
    mesaInput.style.cursor = '';

    // Restaurar título
    const ticketHeader = document.querySelector('.ticket-section .ticket-header h2');
    if (ticketHeader) {
        ticketHeader.innerHTML = '🆕 Nuevo Ticket';
    }

    // Remover botón de cancelar
    const cancelBtn = document.getElementById('btn-cancel-edit');
    if (cancelBtn) cancelBtn.remove();

    // Limpiar carrito
    cart = [];
    renderCart();
    updateTotal();
}

// Cerrar ticket
async function closeTicket(ticketId) {
    if (!confirm('¿Cerrar este ticket? Se marcará como completado.')) return;

    try {
        const result = await window.api.closeTicket(ticketId);
        if (result.success) {
            await refreshOpenTickets();
            alert('Ticket cerrado correctamente');
        } else {
            alert('Error al cerrar ticket');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error de sistema');
    }
}

// Imprimir ticket manualmente desde tickets abiertos
async function printTicketReceipt(ticketId) {
    if (!confirm('¿Imprimir este ticket?')) return;

    try {
        const tickets = await window.api.getTickets();
        const ticket = tickets.find(t => t.id === ticketId);

        if (ticket) {
            await window.api.printTicket(ticket);
        } else {
            alert('Error: Ticket no encontrado');
        }
    } catch (error) {
        console.error('Error al imprimir ticket:', error);
        alert('Error al intentar imprimir el ticket');
    }
}

// =====================================================
// SECCIÓN: CAMBIO DE USUARIO (MESERO)
// =====================================================

function showChangeMesero() {
    const modal = document.getElementById('change-mesero-modal');
    const select = document.getElementById('new-mesero-select');

    // Limpiar select
    select.innerHTML = '<option value="">-- Seleccionar --</option>';

    // Poblar con meseros
    if (meseros && meseros.length > 0) {
        meseros.forEach(m => {
            // No mostrar al usuario actual en la lista
            if (activeMesero && m.id === activeMesero.id) return;

            const option = document.createElement('option');
            option.value = m.id;
            option.textContent = m.nombre;
            select.appendChild(option);
        });
    }

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

            // Recargar para aplicar cambios
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
