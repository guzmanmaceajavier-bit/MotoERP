# MotoERP — Sistema de Gestión para Talleres de Motos

SaaS completo para gestión de talleres mecánicos de motocicletas: sitio público, portal de clientes y panel de administración.

## Stack tecnológico

| Capa | Tecnología |
|------|------------|
| Frontend | React 19 + TypeScript + Tailwind CSS + Vite |
| Backend | Laravel 12 + PHP 8.3 |
| Base de datos | PostgreSQL (Supabase) |
| Deploy frontend | Vercel |
| Deploy backend | Render (Docker) |
| Almacenamiento de imágenes | Cloudinary |

## Funcionalidades

### Sitio público
- Página de inicio con carrusel de imágenes, marcas, servicios destacados, blog y FAQ
- Tienda de repuestos con filtros por marca, modelo, categoría, tipo y precio
- Detalle de producto con variantes de color, stock y favoritos
- Blog con artículos de mantenimiento
- Páginas de servicios, Nosotros, Contacto
- Agendamiento de citas en línea
- Seguimiento de órdenes por número
- Políticas de privacidad y términos legales

### Portal de cliente
- Registro e inicio de sesión
- Dashboard con resumen de pedidos, puntos y garaje
- Mis pedidos con subida de comprobantes de pago
- Mis finanzas (saldo, pagos, facturas)
- Mi garaje (registro de motos con placa, modelo, año)
- Historial de servicios por moto
- Chat con el taller
- Listas de productos compartidos

### Panel de administración
- Dashboard con métricas de ventas, órdenes y clientes
- Gestión de ventas y facturación (caja diaria)
- Órdenes de trabajo con flujo completo (diagnóstico → cotización → aprobación → factura)
- Agenda y citas con calendario
- Inventario de productos con movimientos
- Catálogo de productos, marcas, modelos, categorías
- Compras y proveedores
- Clientes con historial completo
- Garantías
- Blog (crear/editar artículos)
- Calificaciones y reseñas
- Chat con clientes
- Mensajes internos
- Notificaciones
- Reportes de ventas e inventario
- Log de auditoría
- Configuración completa (taller, horarios, pagos, WhatsApp, legal)
- Backup y restore de base de datos

### Carrito de compras
- Layout de 2 columnas con mini carrito (drawer)
- 4 pasos: Carrito → Entrega → Pago → Confirmación
- Opciones de retiro en taller, envío a domicilio o instalación en servicio
- Métodos de pago flexibles (Nequi, Bancolombia, efectivo, etc.)
- Cupones de descuento
- Puntos de fidelización
- IVA configurable
- Estimación de entrega
- Protección contra doble clic

## Estructura del proyecto

```
motoERP/
├── backend/                 # API Laravel
│   ├── app/
│   │   ├── Console/Commands/   # Comandos programados
│   │   ├── Http/Controllers/   # Controladores API
│   │   ├── Jobs/               # Trabajos en cola (WhatsApp)
│   │   ├── Models/             # Modelos Eloquent (39 modelos)
│   │   └── Services/           # Servicios (Cloudinary, Notificaciones)
│   ├── config/                 # Configuración de Laravel
│   ├── database/migrations/    # Migraciones de la base de datos
│   ├── database/seeders/       # Seeders (ProductionSeeder)
│   ├── Dockerfile              # Imagen Docker (php-fpm + nginx)
│   ├── entrypoint.sh           # Script de inicio del contenedor
│   ├── nginx.conf              # Configuración de nginx
│   └── php-fpm.conf            # Configuración de PHP-FPM
├── frontend/                # Aplicación React
│   ├── src/
│   │   ├── auth/               # Contextos de autenticación
│   │   ├── components/         # Componentes reutilizables
│   │   ├── layouts/            # Layouts (público, staff, cliente)
│   │   ├── lib/                # Utilidades (api, cart, money, etc.)
│   │   └── pages/              # Páginas
│   │       ├── public/         # Páginas públicas
│   │       ├── staff/          # Panel de administración
│   │       └── client/         # Portal de cliente
│   ├── vite.config.ts
│   └── package.json
├── render.yaml              # Configuración de Render
└── vercel.json              # Configuración de Vercel
```

## Requisitos

- Node.js 18+
- PHP 8.3+
- Composer
- PostgreSQL 14+
- Cuenta en Vercel, Render, Supabase y Cloudinary

## Configuración local

### Backend

```bash
cd backend
cp .env.example .env
composer install
php artisan key:generate
php artisan migrate
php artisan db:seed --class=ProductionSeeder
php artisan serve
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Variables de entorno

### Backend (`.env`)

| Variable | Descripción |
|----------|-------------|
| `APP_KEY` | Clave de encriptación de Laravel |
| `APP_URL` | URL del backend (ej: `https://motoerp-api.onrender.com`) |
| `DB_CONNECTION` | `pgsql` |
| `DB_HOST` | Host de PostgreSQL (Supabase) |
| `DB_PORT` | `5432` o `6543` (pooler) |
| `DB_DATABASE` | Nombre de la base de datos |
| `DB_USERNAME` | Usuario de PostgreSQL |
| `DB_PASSWORD` | Contraseña de PostgreSQL |
| `FRONTEND_URL` | URL del frontend (Vercel) para CORS |
| `CLOUDINARY_CLOUD_NAME` | Nombre de la nube de Cloudinary |
| `CLOUDINARY_API_KEY` | API key de Cloudinary |
| `CLOUDINARY_API_SECRET` | API secret de Cloudinary |
| `WHATSAPP_ENABLED` | `true` o `false` |
| `WHATSAPP_ACCESS_TOKEN` | Token de Meta Cloud API |
| `WHATSAPP_PHONE_ID` | ID del número de teléfono |

### Frontend

No requiere variables de entorno. La API se conecta vía proxy de Vercel (`/api/v1`).

## Deploy

### Render (Backend)

1. Conecta el repositorio de GitHub
2. Selecciona Docker como runtime
3. Configura las variables de entorno desde el dashboard
4. El `render.yaml` configura todo automáticamente

### Vercel (Frontend)

1. Conecta el repositorio de GitHub
2. Framework: Vite
3. Root directory: `frontend`
4. Build command: `npm run build`
5. Output directory: `dist`

## Credenciales por defecto

| Usuario | Contraseña | Rol |
|---------|-----------|-----|
| `admin@motohub.test` | `secret123` | admin |

> ⚠️ Cambia la contraseña después del primer login.

## API Health Check

```
GET /api/v1/health
→ {"ok": true, "time": "2026-08-27T..."}
```

## Licencia

Proyecto privado. Todos los derechos reservados.
