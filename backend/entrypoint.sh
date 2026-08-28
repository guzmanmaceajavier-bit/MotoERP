#!/bin/sh
set -e

echo "=== Building .env from environment ==="

cat > .env << EOF
APP_KEY=${APP_KEY:-}
APP_NAME=${APP_NAME:-MotoERP}
APP_ENV=production
APP_DEBUG=${APP_DEBUG:-false}
APP_URL=${APP_URL:-https://motoerp-api.onrender.com}
DB_CONNECTION=${DB_CONNECTION:-pgsql}
DB_HOST=${DB_HOST}
DB_PORT=${DB_PORT:-5432}
DB_DATABASE=${DB_DATABASE}
DB_USERNAME=${DB_USERNAME}
DB_PASSWORD=${DB_PASSWORD}
SESSION_DRIVER=database
CACHE_STORE=database
QUEUE_CONNECTION=database
FILESYSTEM_DISK=local
FRONTEND_URL=${FRONTEND_URL:-}
CLOUDINARY_CLOUD_NAME=${CLOUDINARY_CLOUD_NAME:-}
CLOUDINARY_API_KEY=${CLOUDINARY_API_KEY:-}
CLOUDINARY_API_SECRET=${CLOUDINARY_API_SECRET:-}
WHATSAPP_ENABLED=${WHATSAPP_ENABLED:-false}
WHATSAPP_ACCESS_TOKEN=${WHATSAPP_ACCESS_TOKEN:-}
WHATSAPP_PHONE_ID=${WHATSAPP_PHONE_ID:-}
WHATSAPP_TEMPLATE=${WHATSAPP_TEMPLATE:-motohub_notification}
POINTS_VALUE=${POINTS_VALUE:-100}
LOG_LEVEL=${LOG_LEVEL:-error}
EOF

echo "=== Verifying APP_KEY ==="
if [ -z "$APP_KEY" ]; then
  echo "WARNING: APP_KEY is empty! Generating one..."
  php artisan key:generate --force
fi

echo "=== Waiting for database ==="
for i in 1 2 3 4 5; do
  if php artisan db:monitor 2>/dev/null; then
    echo "Database is ready"
    break
  fi
  echo "Attempt $i: Database not ready, waiting 5s..."
  sleep 5
done

echo "=== Running migrations ==="
php artisan migrate --force 2>&1 || echo "Migration skipped"

echo "=== Clearing config cache ==="
php artisan config:clear 2>&1 || true
php artisan optimize:clear 2>&1 || true

echo "=== Creating storage link ==="
php artisan storage:link --force 2>/dev/null || true

echo "=== Configuring nginx ==="
cp /app/nginx.conf /etc/nginx/sites-available/default

echo "=== Starting queue worker ==="
php artisan queue:work --sleep=3 --tries=3 --max-time=3600 &

echo "=== Starting scheduler ==="
php artisan schedule:work &

echo "=== Starting php-fpm + nginx ==="
php-fpm -D
sleep 2
nginx -g 'daemon off;'
