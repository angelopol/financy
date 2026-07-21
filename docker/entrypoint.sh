#!/bin/sh
set -eu

case "${PORT:-10000}" in
    *[!0-9]*|'')
        echo "PORT must be a valid integer" >&2
        exit 1
        ;;
esac

sed -ri "s/^Listen [0-9]+$/Listen ${PORT:-10000}/" /etc/apache2/ports.conf
sed -ri "s/<VirtualHost \*:[0-9]+>/<VirtualHost *:${PORT:-10000}>/" /etc/apache2/sites-available/000-default.conf

mkdir -p storage/app/public storage/framework/cache/data storage/framework/sessions \
    storage/framework/views storage/logs bootstrap/cache
chown -R www-data:www-data storage bootstrap/cache

if [ ! -e public/storage ]; then
    php artisan storage:link
fi

php artisan config:cache

echo "Running database migrations..."
php artisan migrate --force --no-interaction

php artisan route:cache
php artisan view:cache

exec "$@"
