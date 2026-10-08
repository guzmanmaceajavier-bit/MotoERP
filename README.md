# MotoERP

Sistema para administrar un taller de motos: tienda de repuestos, citas, órdenes de trabajo y facturación. Tiene página pública, portal para clientes y panel para el taller. 

## Demo

- Página: https://moto-erp-ckx7.vercel.app
- Panel admin: https://moto-erp-ckx7.vercel.app/admin/login

| Usuario | Clave |
| ------- | ----- |
| `admin@motohub.test` | `secret123` |

La clave del admin la pone el seeder con la variable `SEED_PASSWORD` (`secret123` por defecto en local). En producción hay que configurarla en Render y correr el seeder, si no nadie entra.

## Tecnologías

- Frontend: React + TypeScript + Vite + Tailwind
- Backend: Laravel + Sanctum (tokens)
- Base de datos: PostgreSQL en Supabase
- Imágenes en Cloudinary, frontend en Vercel, backend en Render con Docker
- Tests E2E con Playwright y unitarios/feature con PHPUnit

## Correrlo en local

Backend:

```bash
cd backend
cp .env.example .env
composer install
php artisan key:generate
php artisan migrate
SEED_PASSWORD=secret123 php artisan db:seed --class=ProductionSeeder
php artisan serve
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Tests del frontend:

```bash
cd frontend
npx playwright install
npx playwright test
```

## Deploy

- **Render (backend):** runtime Docker, contexto en `backend`. Revisa el `render.yaml` para ver las variables que pide (base de datos, Cloudinary, `FRONTEND_URL`, `SEED_PASSWORD`).
- **Vercel (frontend):** framework Vite, directorio raíz `frontend`. El `vercel.json` redirige `/api/*` al backend y sirve el SPA.

## Estructura

```
motoERP/
├── backend/          API (Laravel)
│   ├── app/Http/Controllers/Api/   14 controladores
│   ├── app/Models/                 39 modelos
│   ├── app/Services/               25 servicios (facturas, pagos, caja, reportes…)
│   ├── database/migrations/        57 migraciones
│   └── Dockerfile + nginx + entrypoint.sh
├── frontend/         SPA (React + Vite)
│   ├── src/pages/      public + staff + client
│   ├── src/components/ componentes compartidos
│   └── tests/          specs de Playwright
├── render.yaml
└── frontend/vercel.json
```

## Autor

**Javier Guzman** — desarrollo y mantenimiento.

- Email: guzmanmaceajavier@gmail.com
- GitHub: [@guzmanmaceajavier-bit](https://github.com/guzmanmaceajavier-bit)

## Capturas

Inicio:
<img width="1366" height="618" alt="image" src="https://github.com/user-attachments/assets/8a3a1108-9ba6-4cc7-9750-53f1e8be4224" />

-login
<img width="1360" height="612" alt="image" src="https://github.com/user-attachments/assets/9aa87d1b-8a28-4908-b69d-86f00352710e" />

Login admin:
<img width="1254" height="600" alt="image" src="https://github.com/user-attachments/assets/136724e6-33d8-4905-9996-12f635623b33" />

## Licencia

Proyecto privado. © 2026 Javier Guzman. Todos los derechos reservados.
