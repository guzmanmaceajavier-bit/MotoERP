#!/bin/sh
set -e

echo "=== Building .env from environment ==="

cat > .env << EOF
APP_KEY=${APP_KEY:-}
APP_NAME=MotoERP
APP_ENV=production
APP_DEBUG=false
APP_URL=https://motoerp-api.onrender.com
DB_CONNECTION=${DB_CONNECTION:-pgsql}
DB_HOST=${DB_HOST}
DB_PORT=${DB_PORT:-5432}
DB_DATABASE=${DB_DATABASE}
DB_USERNAME=${DB_USERNAME}
DB_PASSWORD=${DB_PASSWORD}
SESSION_DRIVER=database
CACHE_STORE=database
QUEUE_CONNECTION=database
FRONTEND_URL=${FRONTEND_URL:-}
CLOUDINARY_CLOUD_NAME=${CLOUDINARY_CLOUD_NAME:-}
CLOUDINARY_API_KEY=${CLOUDINARY_API_KEY:-}
CLOUDINARY_API_SECRET=${CLOUDINARY_API_SECRET:-}
WHATSAPP_ENABLED=false
POINTS_VALUE=100
EOF

echo "=== Running migrations ==="
php artisan migrate --force 2>&1 || echo "Migration skipped"

echo "=== Configuring nginx ==="
cp /app/nginx.conf /etc/nginx/sites-available/default

echo "=== Starting php-fpm + nginx ==="
php-fpm -D
nginx -g 'daemon off;'
