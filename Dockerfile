FROM node:22-alpine AS frontend

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY resources ./resources
COPY public ./public
COPY vite.config.js postcss.config.js tailwind.config.js ./
RUN npm run build

FROM php:8.2-apache AS php-base

RUN apt-get update \
    && apt-get install -y --no-install-recommends libonig-dev libpq-dev libxml2-dev libzip-dev unzip \
    && docker-php-ext-install -j"$(nproc)" bcmath dom mbstring opcache pdo_mysql pdo_pgsql zip \
    && a2enmod expires headers rewrite \
    && sed -i '/Alias \/icons\//d' /etc/apache2/mods-enabled/autoindex.conf \
    && ! grep -Eq '^[[:space:]]*Alias[[:space:]]+/icons/' /etc/apache2/mods-enabled/autoindex.conf \
    && rm -rf /var/lib/apt/lists/*

FROM php-base AS backend

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
WORKDIR /var/www/html
COPY . .
RUN composer install --no-dev --no-interaction --no-progress --optimize-autoloader \
    && rm -rf tests

FROM php-base AS production

ENV APP_ENV=production \
    APP_DEBUG=false \
    PORT=10000
WORKDIR /var/www/html
COPY --from=backend /var/www/html /var/www/html
COPY --from=frontend /app/public/build /var/www/html/public/build
COPY public/icons/ /var/www/html/public/icons/
COPY docker/apache-vhost.conf /etc/apache2/sites-available/000-default.conf
COPY docker/entrypoint.sh /usr/local/bin/render-entrypoint
RUN chmod +x /usr/local/bin/render-entrypoint \
    && mkdir -p storage/app/public storage/framework/cache/data storage/framework/sessions \
        storage/framework/views storage/logs bootstrap/cache \
    && test -s public/icons/icon.svg \
    && test -s public/icons/maskable.svg \
    && test -s public/icons/icon-192.png \
    && chmod -R a+rX public/icons \
    && chown -R www-data:www-data storage bootstrap/cache

EXPOSE 10000
ENTRYPOINT ["render-entrypoint"]
CMD ["apache2-foreground"]
