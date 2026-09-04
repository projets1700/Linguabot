FROM php:8.3-cli-alpine

WORKDIR /app

RUN apk add --no-cache \
        git \
        unzip \
        icu-dev \
        icu-data-full \
        oniguruma-dev \
        libzip-dev \
        postgresql-dev \
    && docker-php-ext-install -j$(nproc) \
        pdo \
        pdo_pgsql \
        pgsql \
        intl \
        mbstring \
        zip \
        opcache

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

COPY composer.json composer.lock ./
RUN composer install --no-scripts --no-interaction

COPY . .
RUN composer dump-autoload --optimize

EXPOSE 8000

CMD ["php", "-S", "0.0.0.0:8000", "-t", "public"]
