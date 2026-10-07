# MotoERP — Sistema de Gestión para Talleres de Motos

Plataforma SaaS full-stack para la gestión integral de talleres mecánicos de motocicletas. Incluye sitio público, portal de clientes y panel de administración completo.

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
| Frontend | React 19, TypeScript, Tailwind CSS 4, Vite 8 |
| Backend | Laravel 13, PHP 8.3, Sanctum Auth |
| Base de datos | PostgreSQL 16 (Supabase) + PgBouncer (puerto pooler 6543) |
| Deploy | Vercel (frontend, `frontend/vercel.json`) · Render Docker (backend) |
| Almacenamiento | Cloudinary (imágenes) |
| Testing | Playwright (5 specs E2E) + PHPUnit (Feature/Unit) |

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

### Portal de cliente (13 módulos)
- Dashboard personalizado con resumen y puntos de fidelización
- Mis pedidos con subida de comprobantes de pago
- Finanzas: saldo, pagos, facturas e historial
- Mi garaje: registro de motos con placa, modelo, año
- Historial de servicios por moto
- Listas de productos compartidas y favoritos
- Chat directo con el taller
- Notificaciones en tiempo real
- Registro e inicio de sesión con roles

### Panel de administración (20 módulos)
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
├── backend/                    # API REST (Laravel 13)
│   ├── app/
│   │   ├── Console/Commands/   # 3 comandos programados
│   │   ├── Http/Controllers/   # 14 controladores API
│   │   ├── Http/Middleware/     # CheckRole
│   │   ├── Jobs/               # Trabajos en cola (WhatsApp)
│   │   ├── Models/             # 39 modelos Eloquent
│   │   ├── Providers/          # AppServiceProvider
│   │   ├── Services/           # 25 servicios (Invoice, Payment, Timeline, Dashboard, Agenda, Cash, Sale, etc.)
│   │   └── Support/            # Helpers (Settings, Input)
│   ├── config/                 # Configuración de Laravel
│   ├── database/
│   │   ├── migrations/         # 57 migraciones
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
│   ├── tests/                  # 5 specs E2E (Playwright)
│   ├── vite.config.ts
│   ├── playwright.config.ts    # baseURL por env PLAYWRIGHT_BASE_URL (default: prod)
├── render.yaml                 # Render auto-deploy config
└── frontend/vercel.json        # Vercel rewrites + API proxy + CSP (canónico; Root Directory: frontend)
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
# Por defecto corre contra producción. Para local:
# PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173 npx playwright test
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
| `DB_PORT` | `6543` (pooler transaction mode) / `5432` (directa) |
| `DB_DATABASE` | `postgres` |
| `DB_USERNAME` | Usuario de Supabase |
| `DB_PASSWORD` | Contraseña de Supabase |
| `FRONTEND_URL` | Orígenes CORS separados por comas (ej. `http://localhost:5173,https://moto-erp-ckx7.vercel.app`) |
| `POINTS_VALUE` | Valor en COP de cada punto de fidelización (`100`) |
| `SESSION_DRIVER` | `file` en Render (sin Redis en plan free) / `database` en local |
| `CACHE_STORE` | `file` en Render (sin Redis en plan free) / `database` en local |

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
5. Los rewrites de `frontend/vercel.json` manejan SPA routing y proxy a la API (`/api/*` → Render), más headers CSP/security

---

## Arquitectura de datos

- **39 modelos Eloquent** con relaciones completas
- **57 migraciones** de PostgreSQL
- **Supabase PgBouncer** para connection pooling (transaction mode, puerto 6543)
- **Emulación de prepared statements** para compatibilidad con PgBouncer

---

## Autor

**Javier Guzman** — desarrollo y mantenimiento del proyecto.

- Email: guzmanmaceajavier@gmail.com
- GitHub: [@guzmanmaceajavier-bit](https://github.com/guzmanmaceajavier-bit)


-inicio
<img width="1366" height="618" alt="image" src="https://github.com/user-attachments/assets/8a3a1108-9ba6-4cc7-9750-53f1e8be4224" />

-login
<img width="1360" height="612" alt="image" src="https://github.com/user-attachments/assets/9aa87d1b-8a28-4908-b69d-86f00352710e" />

-login admin
<img width="1254" height="600" alt="image" src="https://github.com/user-attachments/assets/136724e6-33d8-4905-9996-12f635623b33" />




## Licencia

Proyecto privado. © 2026 Javier Guzman. Todos los derechos reservados.
