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
RUN cp .env.example .env
RUN php artisan key:generate --force

EXPOSE 8000

CMD ["sh", "-c", "php artisan migrate --force && php artisan db:seed --class=ProductionSeeder --force && php artisan serve --host=0.0.0.0 --port=8000"]
