FROM php:8.3-cli

RUN apt-get update && apt-get install -y \
    libpq-dev \
    libzip-dev \
    unzip \
    && docker-php-ext-install pdo_pgsql zip bcmath \
    && curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer

WORKDIR /app

COPY . .

RUN composer install --no-dev --optimize-autoloader

EXPOSE 8000

CMD ["sh", "-c", "echo \"APP_KEY=\" > .env && echo \"APP_ENV=production\" >> .env && echo \"APP_DEBUG=false\" >> .env && echo \"APP_URL=$APP_URL\" >> .env && echo \"DB_CONNECTION=$DB_CONNECTION\" >> .env && echo \"DB_HOST=$DB_HOST\" >> .env && echo \"DB_PORT=$DB_PORT\" >> .env && echo \"DB_DATABASE=$DB_DATABASE\" >> .env && echo \"DB_USERNAME=$DB_USERNAME\" >> .env && echo \"DB_PASSWORD=$DB_PASSWORD\" >> .env && echo \"SESSION_DRIVER=database\" >> .env && echo \"CACHE_STORE=database\" >> .env && echo \"QUEUE_CONNECTION=database\" >> .env && echo \"FRONTEND_URL=$FRONTEND_URL\" >> .env && echo \"CLOUDINARY_CLOUD_NAME=$CLOUDINARY_CLOUD_NAME\" >> .env && echo \"CLOUDINARY_API_KEY=$CLOUDINARY_API_KEY\" >> .env && echo \"CLOUDINARY_API_SECRET=$CLOUDINARY_API_SECRET\" >> .env && echo \"WHATSAPP_ENABLED=false\" >> .env && echo \"POINTS_VALUE=100\" >> .env && php artisan key:generate --force && php artisan migrate --force && php artisan db:seed --class=ProductionSeeder --force && php artisan serve --host=0.0.0.0 --port=8000"]
