# MotoERP — Sistema de Gestión para Talleres de Motos

Plataforma SaaS full-stack para la gestión integral de talleres mecánicos de motocicletas. Incluye sitio público, portal de clientes y panel de administración completo.

## Demo en vivo

| Componente | URL |
|-----------|-----|
| Sitio público | [moto-erp-ckx7.vercel.app](https://moto-erp-ckx7.vercel.app) |
| API REST | [motoerp-api.onrender.com/api/v1](https://motoerp-api.onrender.com/api/v1) |
| Repositorio | [github.com/guzmanmaceajavier-bit/MotoERP](https://github.com/guzmanmaceajavier-bit/MotoERP) |

### Credenciales de prueba

| Rol | Email | Contraseña |
|-----|-------|-----------|
| Administrador | `admin@motohub.test` | `secret123` |

> Admin tiene acceso total: dashboard, ventas, inventario, órdenes, configuración.

---

## Stack tecnológico

```
Frontend:  React 19 · TypeScript · Tailwind CSS · Vite 8
Backend:   Laravel 12 · PHP 8.3 · Sanctum Auth
Database:  PostgreSQL 16 (Supabase)
Deploy:    Vercel (frontend) · Render Docker (backend)
Storage:   Cloudinary (imágenes)
Testing:   Playwright (42 tests E2E)
```

### Arquitectura

```
┌──────────────────┐     HTTPS      ┌──────────────────┐     SQL      ┌──────────────────┐
│   Vercel (CDN)   │ ──────────────▶ │  Render (Docker) │ ────────────▶ │  Supabase (DB)   │
│  React + Vite    │   /api/* proxy  │  Laravel + nginx  │   PgBouncer  │  PostgreSQL 16   │
└──────────────────┘                 └──────────────────┘              └──────────────────┘
```

---

## Funcionalidades implementadas

### Sitio público (7 secciones)
- Inicio con carrusel de imágenes, marcas, servicios y blog
- Tienda de repuestos con filtros por marca, modelo, categoría, tipo y precio
- Detalle de producto con variantes, stock en tiempo real y favoritos
- Blog de mantenimiento con artículos y FAQ
- Páginas de servicios, Nosotros, Contacto
- Agendamiento de citas en línea
- Seguimiento de órdenes por número

### Portal de cliente (8 módulos)
- Dashboard personalizado con resumen y puntos de fidelización
- Mis pedidos con subida de comprobantes de pago
- Finanzas: saldo, pagos, facturas y historial
- Mi garaje: registro de motos con placa, modelo, año
- Historial de servicios por moto
- Chat en tiempo real con el taller
- Listas de productos compartidas
- Registro e inicio de sesión con roles

### Panel de administración (20+ módulos)
- Dashboard con métricas en tiempo real
- Ventas y facturación con caja diaria
- Órdenes de trabajo con flujo completo: diagnóstico → cotización → aprobación → factura
- Agenda y citas con calendario visual
- Inventario con movimientos de stock
- Catálogo: productos, marcas, modelos, categorías
- Compras y gestión de proveedores
- Clientes con historial completo
- Garantías
- Blog (crear/editar/publicar)
- Calificaciones y reseñas
- Chat con clientes
- Notificaciones internas
- Reportes de ventas e inventario
- Log de auditoría
- Backup y restore de base de datos
- Configuración completa del taller

### Carrito de compras
- Layout responsive de 2 columnas con mini carrito (drawer)
- 4 pasos: Carrito → Entrega → Pago → Confirmación
- Retiro en taller, envío a domicilio o instalación en servicio
- Métodos de pago flexibles (Nequi, Bancolombia, Daviplata, efectivo)
- Cupones de descuento con validación
- Sistema de puntos de fidelización
- IVA configurable
- Estimación de entrega
- Protección contra doble clic

---

## Seguridad implementada

- Autenticación stateless con Laravel Sanctum (tokens)
- Rate limiting por endpoint (login: 10/min, registro: 6/min, API: 200/min auth, 60/min anon)
- CORS configurado por dominio
- Content Security Policy (CSP) headers
- PgBouncer compatible (prepared statements emulados)
- Validación de entrada en todos los endpoints
- Roles y permisos (admin, mechanic, customer)
- Backup automático de base de datos

---

## Estructura del proyecto

```
motoERP/
├── backend/                    # API REST (Laravel 12)
│   ├── app/
│   │   ├── Console/Commands/   # 3 comandos programados
│   │   ├── Http/Controllers/   # 14 controladores API
│   │   ├── Http/Middleware/     # CheckRole
│   │   ├── Jobs/               # Trabajos en cola (WhatsApp)
│   │   ├── Models/             # 39 modelos Eloquent
│   │   ├── Providers/          # AppServiceProvider
│   │   ├── Services/           # 8 servicios (Cloudinary, Notifications, etc.)
│   │   └── Support/            # Helpers (Settings, Input)
│   ├── config/                 # Configuración de Laravel
│   ├── database/
│   │   ├── migrations/         # 20+ migraciones
│   │   └── seeders/            # ProductionSeeder
│   ├── Dockerfile              # php:8.3-fpm + nginx
│   ├── entrypoint.sh           # Startup script
│   ├── nginx.conf              # Reverse proxy config
│   └── php-fpm.conf            # PHP-FPM config
├── frontend/                   # SPA (React + Vite)
│   ├── src/
│   │   ├── auth/               # AuthContext + StaffAuthContext
│   │   ├── components/         # 30+ componentes reutilizables
│   │   ├── layouts/            # PublicLayout, StaffLayout, ClientLayout
│   │   ├── lib/                # api, cart, config, money, etc.
│   │   └── pages/
│   │       ├── public/         # Home, Store, Blog, Contact, About
│   │       ├── staff/          # Dashboard, Orders, Inventory, Config
│   │       └── client/         # Portal del cliente
│   ├── tests/                  # 42 tests E2E (Playwright)
│   ├── vite.config.ts
│   └── playwright.config.ts
├── render.yaml                 # Render auto-deploy config
└── vercel.json                 # Vercel rewrites + API proxy
```

---

## Ejecución local

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

### Tests E2E

```bash
cd frontend
npx playwright install
npx playwright test
```

---

## Variables de entorno

### Backend (`.env`)

| Variable | Descripción |
|----------|-------------|
| `APP_KEY` | Clave de encriptación (generada con `key:generate`) |
| `APP_URL` | URL del backend |
| `DB_CONNECTION` | `pgsql` |
| `DB_HOST` | Host de Supabase Pooler |
| `DB_PORT` | `6543` (pooler) |
| `DB_DATABASE` | `postgres` |
| `DB_USERNAME` | Usuario de Supabase |
| `DB_PASSWORD` | Contraseña de Supabase |
| `FRONTEND_URL` | URL del frontend para CORS |
| `SESSION_DRIVER` | `file` |
| `CACHE_STORE` | `file` |

### Frontend

No requiere variables de entorno. La API se conecta vía proxy de Vercel (`/api/*` → Render).

---

## Proceso de deploy

### Render (Backend)
1. Conectar repositorio de GitHub
2. Seleccionar **Docker** como runtime
3. Configurar variables de entorno
4. El `render.yaml` configura automáticamente health checks y networking

### Vercel (Frontend)
1. Conectar repositorio de GitHub
2. Framework: **Vite**
3. Root directory: `frontend`
4. Build: `npm run build` → Output: `dist`
5. Los rewrites de `vercel.json` manejan SPA routing y proxy a la API

---

## Arquitectura de datos

- **39 modelos Eloquent** con relaciones completas
- **20+ migraciones** de PostgreSQL
- **Supabase PgBouncer** para connection pooling (transaction mode)
- **Emulación de prepared statements** para compatibilidad con PgBouncer

---

## Licencia

Proyecto privado. Todos los derechos reservados.
