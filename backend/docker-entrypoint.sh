#!/bin/sh
set -e

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
    echo "==> Applying migrations"
    python manage.py migrate --noinput
fi

# First owner without a shell: set DJANGO_SUPERUSER_EMAIL and DJANGO_SUPERUSER_PASSWORD
# (Django reads both). Once the account exists this just reports it and carries on;
# remove the password variable afterwards.
if [ -n "${DJANGO_SUPERUSER_EMAIL:-}" ]; then
    echo "==> Creating owner ${DJANGO_SUPERUSER_EMAIL}"
    python manage.py createsuperuser --noinput || echo "==> Owner not created (it may already exist)"
fi

echo "==> Starting gunicorn"
# exec so gunicorn is PID 1 and gets the host's SIGTERM directly.
exec gunicorn blufin.wsgi:application --bind 0.0.0.0:${PORT:-8000} --workers 2
