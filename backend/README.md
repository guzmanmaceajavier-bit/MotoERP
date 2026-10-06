# MotoERP API — Backend (Laravel)

API REST stateless con Sanctum tokens. Ver README principal del repo para demo, credenciales y deploy.

## Stack
PHP 8.3 · Laravel 13 · Sanctum · PostgreSQL 16 (Supabase Pooler 6543, PgBouncer con `ATTR_EMULATE_PREPARES=true`) · nginx + php-fpm (Docker en Render).

## Estructura
- `routes/api.php` — ~150 endpoints bajo prefijo `v1` (públicos, `auth:sanctum`, `role:admin,receptionist,mechanic`).
- `app/Http/Controllers/Api/` — 14 controladores: Auth, Public, Store, Order, Invoice, Finance, Staff, StaffCatalog, Client, Motorcycle, Notification, Content, Chat, Catalog.
- `app/Models/` — 39 modelos Eloquent.
- `database/migrations/` — 57 migraciones.
- `config/cors.php` — orígenes desde `FRONTEND_URL` (coma-separados).
- `entrypoint.sh` — genera `.env` en Render desde variables de entorno (`APP_DEBUG` respeta env, default `false`).

## Desarrollo local
```bash
cp .env.example .env
composer install
php artisan key:generate
php artisan migrate
php artisan db:seed --class=ProductionSeeder
php artisan serve
```

`.env.example` usa `DB_PORT=6543` (pooler). `FRONTEND_URL=http://localhost:5173,https://moto-erp-ckx7.vercel.app`.

## Health
- `GET /health` (nginx, sin PHP) y `GET /api/health` (con chequeo DB).
- `GET /api/v1/health` no existe; la ruta nombrada `login` (`GET /api/v1/login` → 401 JSON) evita el error "Route [login] not defined" en sesiones expiradas.

## Tests
```bash
php artisan test
```
`tests/Feature/OrderFlowTest.php`, `tests/Unit/InventoryServiceTest.php`.
