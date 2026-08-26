#!/bin/sh

echo "=== DEBUG: DB VARIABLES ==="
echo "DB_CONNECTION=$DB_CONNECTION"
echo "DB_HOST=$DB_HOST"
echo "DB_PORT=$DB_PORT"
echo "DB_DATABASE=$DB_DATABASE"
echo "DB_USERNAME=$DB_USERNAME"
echo "DB_PASSWORD length=$(echo -n "$DB_PASSWORD" | wc -c)"
echo "=========================="

cat > .env << EOF
APP_KEY=
APP_NAME=MotoERP
APP_ENV=production
APP_DEBUG=false
APP_URL=https://motoerp-api.onrender.com
DB_CONNECTION=$DB_CONNECTION
DB_HOST=$DB_HOST
DB_PORT=$DB_PORT
DB_DATABASE=$DB_DATABASE
DB_USERNAME=$DB_USERNAME
DB_PASSWORD=$DB_PASSWORD
SESSION_DRIVER=database
CACHE_STORE=database
QUEUE_CONNECTION=database
FRONTEND_URL=$FRONTEND_URL
CLOUDINARY_CLOUD_NAME=$CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY=$CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET=$CLOUDINARY_API_SECRET
WHATSAPP_ENABLED=false
POINTS_VALUE=100
EOF

php artisan key:generate --force

php artisan migrate --force 2>&1 || echo "Migration skipped (tables already exist)"
php artisan db:seed --force 2>&1 || echo "Seeder skipped"
php artisan serve --host=0.0.0.0 --port=8000
