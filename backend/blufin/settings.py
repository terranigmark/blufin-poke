"""
Django settings for the Blufin Poke Co backend.

Everything that differs between a laptop and production (Koyeb + Neon) comes
from environment variables; see .env.example.
"""

import os
from datetime import timedelta
from pathlib import Path

import dj_database_url

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "django-insecure-dev-only-change-in-production")

# Off unless asked for, so a deployment is never debug-enabled because a variable was forgotten.
DEBUG = os.environ.get("DJANGO_DEBUG", "False").lower() in ("true", "1")

# A real database means a real deployment: never sign its sessions with the public dev key.
if os.environ.get("DATABASE_URL") and SECRET_KEY.startswith("django-insecure-"):
    raise RuntimeError("Set DJANGO_SECRET_KEY when DATABASE_URL is set.")

ALLOWED_HOSTS = os.environ.get("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")

# Required for the admin login form on any non-localhost origin, e.g. https://<app>.koyeb.app
CSRF_TRUSTED_ORIGINS = [
    o.strip() for o in os.environ.get("DJANGO_CSRF_TRUSTED_ORIGINS", "").split(",") if o.strip()
]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "accounts",
    "menu",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.locale.LocaleMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "blufin.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "blufin.wsgi.application"

# DATABASE_URL is Neon's connection string in production; without it, local SQLite.
# The connection is reused and health-checked because Neon suspends when idle and
# drops pooled sockets (same reasoning as Cervesoft's settings).
DATABASES = {
    "default": dj_database_url.config(
        default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}",
        conn_max_age=int(os.environ.get("DB_CONN_MAX_AGE", "600")),
        conn_health_checks=True,
    )
}

AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "es-mx"
TIME_ZONE = "America/Mazatlan"  # La Paz, BCS
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}

# Koyeb terminates TLS at its edge and forwards plain HTTP.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
if not DEBUG:
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True

# --- API (same stack as Cervesoft: DRF + Simple JWT) ---
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ("rest_framework_simplejwt.authentication.JWTAuthentication",),
    "DEFAULT_THROTTLE_RATES": {"login": "10/min"},
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "AUTH_HEADER_TYPES": ("Bearer",),
}

# The website (blufinpoke.com, Vercel previews) calls /api/ from the browser with a
# Bearer token, never cookies, so no credentials are allowed cross-origin.
CORS_URLS_REGEX = r"^/api/.*$"
CORS_ALLOWED_ORIGIN_REGEXES = [
    r"^https://(www\.)?blufinpoke\.com$",
    r"^https://[\w-]+\.vercel\.app$",
]
CORS_ALLOWED_ORIGINS = [
    o.strip() for o in os.environ.get("DJANGO_CORS_ALLOWED_ORIGINS", "").split(",") if o.strip()
]
if DEBUG:
    CORS_ALLOWED_ORIGINS += ["http://localhost:3000", "http://127.0.0.1:3000"]

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
