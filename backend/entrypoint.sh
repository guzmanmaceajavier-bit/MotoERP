#!/bin/sh
set -e

export APP_DEBUG=${APP_DEBUG:-false}

echo "=== Building .env from environment ==="

cat > .env << EOF
APP_KEY=${APP_KEY:-}
APP_NAME=${APP_NAME:-MotoERP}
APP_ENV=production
APP_DEBUG=true
APP_URL=${APP_URL:-https://motoerp-api.onrender.com}
DB_CONNECTION=${DB_CONNECTION:-pgsql}
DB_HOST=${DB_HOST}
DB_PORT=${DB_PORT:-5432}
DB_DATABASE=${DB_DATABASE}
DB_USERNAME=${DB_USERNAME}
DB_PASSWORD=${DB_PASSWORD}
SESSION_DRIVER=${SESSION_DRIVER:-file}
CACHE_STORE=${CACHE_STORE:-file}
QUEUE_CONNECTION=${QUEUE_CONNECTION:-sync}
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
  php artisan key:generate --force 2>&1 || true
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

echo "=== Ensuring APP_KEY in .env ==="
if ! grep -q "^APP_KEY=base64:" .env 2>/dev/null; then
  echo "APP_KEY missing or invalid, generating..."
  php artisan key:generate --force 2>&1 || true
fi

echo "=== Ensuring storage dirs ==="
mkdir -p storage/framework/cache/data storage/framework/sessions storage/framework/views bootstrap/cache storage/logs
chown -R www-data:www-data storage bootstrap/cache 2>/dev/null || true
chmod -R 775 storage bootstrap/cache 2>/dev/null || true

echo "=== Creating storage link ==="
php artisan storage:link --force 2>/dev/null || true

echo "=== Configuring nginx ==="
mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled 2>/dev/null || true
cp /app/nginx.conf /etc/nginx/sites-available/default 2>/dev/null || true
cp /app/nginx.conf /etc/nginx/conf.d/default.conf 2>/dev/null || true
# Ensure php-fpm config is present (fallback if Dockerfile copy missed cache)
if [ -f /app/php-fpm.conf ] && [ ! -f /usr/local/etc/php-fpm.d/www.conf ]; then
  cp /app/php-fpm.conf /usr/local/etc/php-fpm.d/www.conf 2>/dev/null || true
fi

echo "=== Starting queue worker (only if queue is database) ==="
if [ "${QUEUE_CONNECTION:-sync}" = "database" ]; then
  php artisan queue:work --sleep=3 --tries=3 --max-time=3600 &
else
  echo "Queue is ${QUEUE_CONNECTION:-sync}, skipping queue worker"
fi

echo "=== Starting scheduler ==="
php artisan schedule:work &

echo "=== Starting php-fpm + nginx ==="
php-fpm -D
sleep 2
nginx -g 'daemon off;'
