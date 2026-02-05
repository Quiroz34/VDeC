# 🌮 Sistema POS para Taquería

Aplicación de escritorio para gestionar ventas en un restaurante de tacos.

## 📋 Características

- ✅ **Gestión de Tickets**: Crear tickets de venta con productos, bebidas y extras
- ✅ **Base de Datos Local**: SQLite para almacenar productos y ventas
- ✅ **Información Completa**: Número de mesa y nombre del mesero en cada ticket
- ✅ **CRUD de Productos**: Agregar, editar y eliminar productos, bebidas y extras
- ✅ **Impresión de Tickets**: Imprimir tickets para entregar al cliente
- ✅ **Interfaz Moderna**: Diseño premium con glassmorphism y animaciones

## 🚀 Instalación

### Instalación Rápida

```powershell
npm install
```

### Si hay errores

```powershell
# 1. Limpiar caché de npm
npm cache clean --force

# 2. Eliminar node_modules si existe
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue

# 3. Reinstalar
npm install
```

## 📦 Estructura del Proyecto

```
VDeC/
├── src/
│   ├── main/
│   │   ├── main.js              # Proceso principal de Electron
│   │   ├── preload.js           # Script de precarga para APIs seguras
│   │   └── database.js          # Gestor de base de datos SQLite
│   └── renderer/
│       ├── index.html           # Pantalla principal del POS
│       ├── admin.html           # Panel de administración
│       ├── css/
│       │   ├── styles.css       # Estilos de la pantalla principal
│       │   └── admin.css        # Estilos del panel de administración
│       └── js/
│           ├── renderer.js      # Lógica de la pantalla principal
│           └── admin.js         # Lógica del panel de administración
├── node_modules/
├── package.json                 # Configuración del proyecto
├── .gitignore
├── README.md
├── iniciar.bat                  # Script para iniciar la aplicación
└── instalar.bat                 # Script para instalar dependencias
```

## 🎮 Uso

### Iniciar la Aplicación

```powershell
npm start
```

O en modo desarrollo (con DevTools):

```powershell
npm run dev
```

### Crear un Ticket

1. Selecciona la pestaña de productos (Tacos, Bebidas o Extras)
2. Haz clic en los productos para agregarlos al ticket
3. Ajusta las cantidades con los botones + y -
4. Ingresa el número de mesa
5. Selecciona el mesero
6. Haz clic en "Imprimir Ticket"

### Administrar Productos

1. Haz clic en "⚙️ Administrar Productos" en la pantalla principal
2. Selecciona la pestaña del tipo de producto (Tacos, Bebidas o Extras)
3. Completa el formulario para agregar nuevos productos
4. Usa el botón "🗑️ Eliminar" para eliminar productos existentes

## 💾 Base de Datos

La base de datos se guarda automáticamente como un archivo JSON en:
```
C:\Users\[TU_USUARIO]\AppData\Roaming\pos-restaurante-tacos\restaurante.json
```

### Datos Precargados

La aplicación incluye datos de ejemplo:

**Tacos:**
- Taco de Asada ($25.00)
- Taco de Pastor ($25.00)
- Taco de Pollo ($22.00)
- Taco de Carnitas ($25.00)
- Taco de Chorizo ($23.00)
- Taco de Lengua ($30.00)

**Bebidas:**
- Coca-Cola ($20.00)
- Agua Natural ($15.00)
- Agua de Horchata ($25.00)
- Agua de Jamaica ($25.00)
- Cerveza ($35.00)
- Jugo de Naranja ($30.00)

**Extras:**
- Guacamole ($15.00)
- Queso Fundido ($20.00)
- Frijoles Charros ($25.00)
- Papas Fritas ($30.00)
- Salsa Extra ($5.00)
- Tortillas Extra ($10.00)

**Meseros:**
- Juan Pérez
- María González
- Carlos Rodríguez
- Ana Martínez

## 🖨️ Impresión

El sistema genera tickets con formato térmico (80mm) que incluyen:
- Nombre del restaurante
- Número de mesa
- Nombre del mesero
- Fecha y hora
- Lista de productos con cantidades y precios
- Total a pagar

## 🛠️ Tecnologías

- **Electron**: Framework para aplicaciones de escritorio
- **JSON**: Almacenamiento de datos local
- **HTML/CSS/JavaScript**: Interfaz de usuario moderna

## 📝 Notas

- La aplicación funciona completamente offline
- Todos los datos se guardan localmente
- No requiere conexión a internet
- Compatible con Windows

## 🐛 Solución de Problemas

### La aplicación no inicia

1. Verifica que las dependencias estén instaladas: `npm list`
2. Limpia e reinstala: `npm cache clean --force && npm install`
3. Intenta ejecutar en modo desarrollo: `npm run dev`

### Errores de instalación

Si encuentras errores al instalar:
- Asegúrate de tener Node.js versión 16 o superior
- Ejecuta PowerShell como administrador
- Limpia la caché de npm: `npm cache clean --force`

## 📄 Licencia

MIT
