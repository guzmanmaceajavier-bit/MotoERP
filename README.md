# MotoERP — Sistema de Gestión para Talleres de Motos

Plataforma SaaS full-stack para la gestión integral de talleres mecánicos de motocicletas. Incluye sitio público, portal de clientes y panel de administración completo.

## Demo en vivo

### Sitio público
| Sección | URL |
|---------|-----|
| Inicio | [moto-erp-ckx7.vercel.app](https://moto-erp-ckx7.vercel.app) |
| Tienda | [moto-erp-ckx7.vercel.app/tienda](https://moto-erp-ckx7.vercel.app/tienda) |
| Servicios | [moto-erp-ckx7.vercel.app/servicios](https://moto-erp-ckx7.vercel.app/servicios) |
| Blog | [moto-erp-ckx7.vercel.app/blog](https://moto-erp-ckx7.vercel.app/blog) |
| Agendar cita | [moto-erp-ckx7.vercel.app/agendar](https://moto-erp-ckx7.vercel.app/agendar) |
| Nosotros | [moto-erp-ckx7.vercel.app/nosotros](https://moto-erp-ckx7.vercel.app/nosotros) |
| Contacto | [moto-erp-ckx7.vercel.app/contacto](https://moto-erp-ckx7.vercel.app/contacto) |

### Panel de administración
| Sección | URL |
|---------|-----|
| Login admin | [moto-erp-ckx7.vercel.app/admin/login](https://moto-erp-ckx7.vercel.app/admin/login) |
| Dashboard | [moto-erp-ckx7.vercel.app/admin/dashboard](https://moto-erp-ckx7.vercel.app/admin/dashboard) |
| Ventas / Pedidos | [moto-erp-ckx7.vercel.app/admin/orders](https://moto-erp-ckx7.vercel.app/admin/orders) |
| Inventario | [moto-erp-ckx7.vercel.app/admin/inventory](https://moto-erp-ckx7.vercel.app/admin/inventory) |
| Catálogo productos | [moto-erp-ckx7.vercel.app/admin/products](https://moto-erp-ckx7.vercel.app/admin/products) |
| Marcas | [moto-erp-ckx7.vercel.app/admin/brands](https://moto-erp-ckx7.vercel.app/admin/brands) |
| Clientes | [moto-erp-ckx7.vercel.app/admin/clients](https://moto-erp-ckx7.vercel.app/admin/clients) |
| Órdenes de servicio | [moto-erp-ckx7.vercel.app/admin/work-orders](https://moto-erp-ckx7.vercel.app/admin/work-orders) |
| Agenda | [moto-erp-ckx7.vercel.app/admin/appointments](https://moto-erp-ckx7.vercel.app/admin/appointments) |
| Blog | [moto-erp-ckx7.vercel.app/admin/blog](https://moto-erp-ckx7.vercel.app/admin/blog) |
| Compras | [moto-erp-ckx7.vercel.app/admin/purchases](https://moto-erp-ckx7.vercel.app/admin/purchases) |
| Garantías | [moto-erp-ckx7.vercel.app/admin/warranties](https://moto-erp-ckx7.vercel.app/admin/warranties) |
| Calificaciones | [moto-erp-ckx7.vercel.app/admin/ratings](https://moto-erp-ckx7.vercel.app/admin/ratings) |
| Notificaciones | [moto-erp-ckx7.vercel.app/admin/notifications](https://moto-erp-ckx7.vercel.app/admin/notifications) |
| Configuración | [moto-erp-ckx7.vercel.app/admin/config](https://moto-erp-ckx7.vercel.app/admin/config) |

### Portal de clientes
| Sección | URL |
|---------|-----|
| Login cliente | [moto-erp-ckx7.vercel.app/login](https://moto-erp-ckx7.vercel.app/login) |
| Registro | [moto-erp-ckx7.vercel.app/registro](https://moto-erp-ckx7.vercel.app/registro) |
| Panel cliente | [moto-erp-ckx7.vercel.app/panel](https://moto-erp-ckx7.vercel.app/panel) |
| Mis pedidos | [moto-erp-ckx7.vercel.app/panel/pedidos](https://moto-erp-ckx7.vercel.app/panel/pedidos) |
| Mi garaje | [moto-erp-ckx7.vercel.app/panel/garaje](https://moto-erp-ckx7.vercel.app/panel/garaje) |
| Mis finanzas | [moto-erp-ckx7.vercel.app/panel/mi-cuenta](https://moto-erp-ckx7.vercel.app/panel/mi-cuenta) |
| Servicios | [moto-erp-ckx7.vercel.app/panel/servicios](https://moto-erp-ckx7.vercel.app/panel/servicios) |
| Tienda (logueado) | [moto-erp-ckx7.vercel.app/panel/tienda](https://moto-erp-ckx7.vercel.app/panel/tienda) |

### Credenciales de prueba

| Rol | Email | Contraseña |
|-----|-------|-----------|
| Administrador | `admin@motohub.test` | `secret123` |
| Cliente | Crear desde `/registro` | — |

> **Admin** tiene acceso total: dashboard, ventas, inventario, órdenes, configuración.
> **Cliente** puede comprar, subir comprobantes, agendar citas, gestionar motos.

### APIs

| Endpoint | URL |
|----------|-----|
| Base URL | [motoerp-api.onrender.com/api/v1](https://motoerp-api.onrender.com/api/v1) |
| Health check | [motoerp-api.onrender.com/health](https://motoerp-api.onrender.com/health) |
| Documentación | Ver `routes/api.php` en el repositorio |

---

## Stack tecnológico

| Capa | Tecnologías |
|------|------------|
| Frontend | React 19, TypeScript, Tailwind CSS, Vite 8 |
| Backend | Laravel 12, PHP 8.3, Sanctum Auth |
| Base de datos | PostgreSQL 16 (Supabase) + PgBouncer |
| Deploy | Vercel (frontend) · Render Docker (backend) |
| Almacenamiento | Cloudinary (imágenes) |
| Testing | Playwright (42 tests E2E) |

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

### Carrito de compras
- Layout responsive de 2 columnas con mini carrito (drawer)
- 4 pasos: Carrito → Entrega → Pago → Confirmación
- Retiro en taller, envío a domicilio o instalación en servicio
- Métodos de pago: efectivo y transferencia (Nequi, Bancolombia, Daviplata)
- Datos de pago configurables desde el panel admin
- Botón WhatsApp para enviar comprobante de pago
- Checkout de invitado sin registro
- Sistema de puntos de fidelización (configurable)
- IVA configurable, estimación de entrega, protección contra doble clic

### Portal de cliente (8 módulos)
- Dashboard personalizado con resumen y puntos de fidelización
- Mis pedidos con subida de comprobantes de pago
- Finanzas: saldo, pagos, facturas e historial
- Mi garaje: registro de motos con placa, modelo, año
- Historial de servicios por moto
- Listas de productos compartidas
- Notificaciones en tiempo real
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
- Notificaciones internas
- Reportes de ventas e inventario
- Log de auditoría
- Configuración completa del taller (datos, redes, pagos, hero, banners)

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
