#!/bin/sh
set -e

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
    echo "==> Applying migrations"
    python manage.py migrate --noinput
fi

echo "==> Starting gunicorn"
# exec so gunicorn is PID 1 and gets the host's SIGTERM directly.
exec gunicorn blufin.wsgi:application --bind 0.0.0.0:${PORT:-8000} --workers 2
