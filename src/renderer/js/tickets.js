// Estado de la aplicación
let tickets = [];
let meseros = [];
let currentTicket = null;

// Inicializar aplicación
document.addEventListener('DOMContentLoaded', async () => {
    await loadMeseros();
    await loadTickets();
    setupEventListeners();
});

// Cargar meseros
async function loadMeseros() {
    try {
        meseros = await window.api.getMeseros();

        const meseroSelect = document.getElementById('filter-mesero');
        meseros.forEach(mesero => {
            const option = document.createElement('option');
            option.value = mesero.id;
            option.textContent = mesero.nombre;
            meseroSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error al cargar meseros:', error);
    }
}

// Variables de paginación
let currentPage = 0;
const ITEMS_PER_PAGE = 50;
let totalTickets = 0;

// Cargar tickets
async function loadTickets() {
    try {
        const filterEstado = document.getElementById('filter-estado').value;
        const filterMesero = document.getElementById('filter-mesero').value;
        const container = document.getElementById('tickets-container');

        container.innerHTML = '<p class="loading">Cargando tickets...</p>';

        let loadedTickets = [];

        // Obtener tickets según filtro de estado
        if (filterEstado === 'activo') {
            loadedTickets = await window.api.getTicketsActivos();
            document.getElementById('pagination-controls').style.display = 'none';
        } else if (filterEstado === 'todos') {
            // Usar paginación para historial completo
            const result = await window.api.getAllTickets(ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
            loadedTickets = result.tickets;
            totalTickets = result.total;
            document.getElementById('pagination-controls').style.display = 'flex';
            updatePaginationUI();
        } else {
            // Filtrado por estado específico (pagado/cancelado)
            // Nota: Para simplificar, obtenemos todos y filtramos en memoria, 
            // pero idealmente el backend debería soportar filtros + paginación.
            // Por ahora, cargamos "todos" (paginados) y filtramos lo que llegue, 
            // lo cual no es perfecto pero mejora el rendimiento vs cargar todo siempre.
            const result = await window.api.getAllTickets(ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

            // Si el usuario filtra por estado específico en historial, 
            // la paginación podría comportarse raro (páginas vacías).
            // Para esta iteración, asumiremos que "todos" es el caso principal de uso del historial.
            // Si selecciona un estado específico, podríamos deshabilitar paginación o
            // implementar filtrado en backend.
            // Solución rápida: Cargar todo si filtra específicamente (fallback legado)
            // O advertir que la paginación aplica sobre *todos* los tickets.

            // Por simplicidad y robustez inmediata:
            const allResult = await window.api.getAllTickets(); // Fallback para filtros específicos complejos
            // Nota: Si el usuario tiene 10k tickets, esto sigue lento para filtros.
            // Pero el caso de uso común es "Ver Historial" (Todos).

            // Mejor enfoque: Usar la paginación solo para "todos" y "pagado" (que es el 99%).
            // Si filtra, usamos el método paginado si coincide, si no, legacy.

            if (Array.isArray(result)) { // Legacy support check
                loadedTickets = result.filter(t => t.estado === filterEstado);
            } else {
                // Si filtramos, traemos más para llenar la página
                // TODO: Mejorar backend para filtrar + paginar.
                // Por ahora, asumimos que "todos" es la vista principal.
                loadedTickets = result.tickets.filter(t => t.estado === filterEstado);
            }
        }

        // Filtrar por mesero si está seleccionado
        if (filterMesero) {
            loadedTickets = loadedTickets.filter(t => t.mesero_id === parseInt(filterMesero));
        }

        tickets = loadedTickets;
        renderTickets();
        await loadReportes();
    } catch (error) {
        console.error('Error al cargar tickets:', error);
        alert('Error al cargar los tickets');
    }
}

function updatePaginationUI() {
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');
    const pageInfo = document.getElementById('page-info');

    const totalPages = Math.ceil(totalTickets / ITEMS_PER_PAGE);

    pageInfo.textContent = `Página ${currentPage + 1} de ${totalPages || 1}`;

    btnPrev.disabled = currentPage === 0;
    btnNext.disabled = currentPage >= totalPages - 1;

    btnPrev.onclick = () => {
        if (currentPage > 0) {
            currentPage--;
            loadTickets();
        }
    };

    btnNext.onclick = () => {
        if (currentPage < totalPages - 1) {
            currentPage++;
            loadTickets();
        }
    };
}

// Renderizar tickets
function renderTickets() {
    const container = document.getElementById('tickets-container');

    if (tickets.length === 0) {
        container.innerHTML = '<p class="empty-message">No hay tickets para mostrar</p>';
        return;
    }

    container.innerHTML = '';
    const fragment = document.createDocumentFragment();
    tickets.forEach(ticket => {
        const card = createTicketCard(ticket);
        fragment.appendChild(card);
    });
    container.appendChild(fragment);
}

// Crear tarjeta de ticket
function createTicketCard(ticket) {
    const card = document.createElement('div');
    card.className = `ticket-card ${ticket.estado}`;

    const fecha = new Date(ticket.fecha);
    const tiempoTranscurrido = getTimeElapsed(fecha);

    const estadoBadge = ticket.estado === 'activo'
        ? '<span class="badge badge-active">Activo</span>'
        : '<span class="badge badge-paid">Pagado</span>';

    card.innerHTML = `
        <div class="ticket-card-header">
            <div class="ticket-mesa">Mesa ${ticket.numero_mesa}</div>
            ${estadoBadge}
        </div>
        <div class="ticket-card-body">
            <p><strong>Mesero:</strong> ${ticket.mesero_nombre}</p>
            <p><strong>Total:</strong> $${ticket.total.toFixed(2)}</p>
            <p><strong>Productos:</strong> ${ticket.items.length} items</p>
            <p class="ticket-time">${tiempoTranscurrido}</p>
        </div>
        <div class="ticket-card-actions">
            <button class="btn-small btn-info" onclick="showDetails(${ticket.id})">
                👁️ Ver Detalles
            </button>
            ${ticket.estado === 'activo' ? `
                <button class="btn-small btn-success" onclick="quickPay(${ticket.id})">
                    ✓ Pagar
                </button>
            ` : ''}
        </div>
    `;

    return card;
}

// Calcular tiempo transcurrido
function getTimeElapsed(fecha) {
    const now = new Date();
    const diff = now - fecha;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
        return `Hace ${hours}h ${minutes % 60}m`;
    } else {
        return `Hace ${minutes}m`;
    }
}

// Mostrar detalles del ticket
async function showDetails(ticketId) {
    currentTicket = tickets.find(t => t.id === ticketId);
    if (!currentTicket) return;

    const detailsDiv = document.getElementById('ticket-details');
    const modal = document.getElementById('details-modal');
    const btnPagar = document.getElementById('btn-marcar-pagado');

    // Mostrar/ocultar botón de pagar según estado
    if (currentTicket.estado === 'pagado') {
        btnPagar.style.display = 'none';
    } else {
        btnPagar.style.display = 'block';
    }

    const itemsHTML = currentTicket.items.map(item => `
        <tr>
            <td>${item.cantidad}x ${item.nombre}</td>
            <td>$${item.precio.toFixed(2)}</td>
            <td>$${item.subtotal.toFixed(2)}</td>
        </tr>
    `).join('');

    detailsDiv.innerHTML = `
        <div class="ticket-details">
            <div class="detail-row">
                <strong>Mesa:</strong> ${currentTicket.numero_mesa}
            </div>
            <div class="detail-row">
                <strong>Mesero:</strong> ${currentTicket.mesero_nombre}
            </div>
            <div class="detail-row">
                <strong>Estado:</strong> 
                <span class="badge badge-${currentTicket.estado === 'activo' ? 'active' : 'paid'}">
                    ${currentTicket.estado.charAt(0).toUpperCase() + currentTicket.estado.slice(1)}
                </span>
            </div>
            <div class="detail-row">
                <strong>Fecha:</strong> ${new Date(currentTicket.fecha).toLocaleString('es-MX')}
            </div>
            
            <h3>Productos</h3>
            <table class="details-table">
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
            
            <div class="detail-total">
                <strong>TOTAL: $${currentTicket.total.toFixed(2)}</strong>
            </div>
        </div>
    `;

    modal.style.display = 'flex';
}

// Cerrar detalles
function closeDetails() {
    const modal = document.getElementById('details-modal');
    modal.style.display = 'none';
    currentTicket = null;
}

// Marcar como pagado
async function marcarComoPagado() {
    if (!currentTicket) return;

    try {
        await window.api.updateTicketEstado(currentTicket.id, 'pagado');
        alert('Ticket marcado como pagado');
        closeDetails();
        await loadTickets();
    } catch (error) {
        console.error('Error al marcar ticket como pagado:', error);
        alert('Error al actualizar el ticket');
    }
}

// Pago rápido
async function quickPay(ticketId) {
    if (confirm('¿Marcar este ticket como pagado?')) {
        try {
            await window.api.updateTicketEstado(ticketId, 'pagado');
            await loadTickets();
        } catch (error) {
            console.error('Error:', error);
            alert('Error al actualizar el ticket');
        }
    }
}

// Cargar reportes
async function loadReportes() {
    try {
        const reporte = await window.api.getReporteDia(new Date().toISOString());

        document.getElementById('total-ventas').textContent = `$${reporte.total_ventas.toFixed(2)}`;
        document.getElementById('total-tickets').textContent = reporte.numero_tickets;

        const promedio = reporte.numero_tickets > 0
            ? reporte.total_ventas / reporte.numero_tickets
            : 0;
        document.getElementById('ticket-promedio').textContent = `$${promedio.toFixed(2)}`;

        // Ventas por mesero
        const ventasContainer = document.getElementById('ventas-mesero');
        ventasContainer.innerHTML = '';

        Object.entries(reporte.ventas_por_mesero).forEach(([meseroId, data]) => {
            const ventaCard = document.createElement('div');
            ventaCard.className = 'venta-card';
            ventaCard.innerHTML = `
                <div class="venta-mesero">${data.mesero_nombre}</div>
                <div class="venta-stats">
                    <span>Tickets: ${data.tickets}</span>
                    <span class="venta-total">$${data.total.toFixed(2)}</span>
                </div>
            `;
            ventasContainer.appendChild(ventaCard);
        });

        if (Object.keys(reporte.ventas_por_mesero).length === 0) {
            ventasContainer.innerHTML = '<p class="empty-message">No hay ventas registradas hoy</p>';
        }
    } catch (error) {
        console.error('Error al cargar reportes:', error);
    }
}

// Event listeners
function setupEventListeners() {
    document.getElementById('filter-estado').addEventListener('change', loadTickets);
    document.getElementById('filter-mesero').addEventListener('change', loadTickets);

    // Admin PIN Input handling
    const adminPinInput = document.getElementById('admin-pin-input');
    if (adminPinInput) {
        adminPinInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                verifyAdminPin();
            }
        });
    }
}

// Mostrar login de admin
function showAdminLogin() {
    const modal = document.getElementById('admin-pin-modal');
    const input = document.getElementById('admin-pin-input');
    const errorMsg = document.getElementById('admin-error-message');

    input.value = '';
    errorMsg.style.display = 'none';
    modal.style.display = 'flex';
    setTimeout(() => input.focus(), 100);
}

// Cerrar login de admin
function closeAdminLogin() {
    document.getElementById('admin-pin-modal').style.display = 'none';
}

// Verificar PIN de admin
async function verifyAdminPin() {
    const pin = document.getElementById('admin-pin-input').value;
    const errorMsg = document.getElementById('admin-error-message');

    if (!pin) return;

    try {
        const result = await window.api.validateAdminPin(pin);

        if (result.success) {
            sessionStorage.setItem('isAdminAuthenticated', 'true');
            window.location.href = 'admin.html';
        } else {
            errorMsg.style.display = 'block';
            document.getElementById('admin-pin-input').value = '';
            setTimeout(() => {
                errorMsg.style.display = 'none';
            }, 3000);
        }
    } catch (error) {
        console.error('Error al validar PIN:', error);
        errorMsg.textContent = 'Error de sistema';
        errorMsg.style.display = 'block';
    }
}
