# Blufin backend (Django)

| Route | Who | What |
| --- | --- | --- |
| `/admin/` | Owners (superusers) | Django Admin: create and edit accounts |
| `/menu/` | Owners and employees with **Puede editar el menú** | Django-admin menu editor (backup for the one at blufinpoke.com/login) |
| `/api/menu/` | Anyone | The live menu the website shows (available items only) |
| `/api/auth/login/`, `/api/auth/refresh/` | Menu editors | Email + password → JWT pair (30 min access, 7 day refresh), like Cervesoft |
| `/api/editor/`, `/api/editor/<sizes\|ingredients\|extras\|beers\|drinks>/` | Menu editors | Everything incl. hidden items; create, edit, delete |

Everyone signs in with email and password. To give an employee menu access, open
`/admin/` → Usuarios → Añadir, enter their email and a password, and tick
**Puede editar el menú**. Leave "Es staff" off so they only see the menu.

The menu starts with the items the website ships today (`src/data/menu.ts`). The
website's editor at `blufinpoke.com/login` edits it through `/api/`, and the menu,
Arma tu poke and the TV screen read `/api/menu/`, falling back to `menu.ts` if the
API can't be reached. CORS lets `blufinpoke.com`, `www.blufinpoke.com` and
`*.vercel.app` call `/api/`; add others with `DJANGO_CORS_ALLOWED_ORIGINS`.

## Local

```bash
cd backend
uv sync
DJANGO_DEBUG=True uv run python manage.py migrate
DJANGO_DEBUG=True uv run python manage.py createsuperuser   # first owner
DJANGO_DEBUG=True uv run python manage.py runserver
uv run python manage.py test
```

Without `DATABASE_URL` it uses `backend/db.sqlite3`.

## CI

`.github/workflows/backend.yml` runs on every PR and push to `main` that touches `backend/`:
tests against Postgres 17 (the engine Neon runs), a check that no model change is missing
its migration, Django's deploy checks, and a Docker build of the image Koyeb will run.

## Deploy (Koyeb + Neon)

One-time setup; after that every push to `main` redeploys on its own.

1. **Neon:** create a project and database, and copy its connection string
   (`postgresql://…neon.tech/…?sslmode=require`).
2. **Koyeb:** Create Service → GitHub → `terranigmark/blufin-poke`, branch `main`.
   - Builder: **Dockerfile**. Work directory: `backend`. Dockerfile location: `Dockerfile`.
   - Port: `8000`, HTTP, path `/`.
   - Environment variables (mark the first two as secrets):

     | Variable | Value |
     | --- | --- |
     | `DJANGO_SECRET_KEY` | a long random string, e.g. `python -c "import secrets; print(secrets.token_urlsafe(50))"` |
     | `DATABASE_URL` | the Neon connection string |
     | `DJANGO_ALLOWED_HOSTS` | the Koyeb host, e.g. `blufin-api-xxxx.koyeb.app` |
     | `DJANGO_CSRF_TRUSTED_ORIGINS` | the same host with `https://` |

   - Leave **Autodeploy** on, so pushes to `main` redeploy.
3. On start the container applies migrations (set `RUN_MIGRATIONS=false` to skip),
   which also loads the starting menu.
4. First owner account, no shell needed: add `DJANGO_SUPERUSER_EMAIL` and
   `DJANGO_SUPERUSER_PASSWORD` (as a secret) to the service and redeploy. The account is
   created on start; later starts just note that it exists. Then delete
   `DJANGO_SUPERUSER_PASSWORD` from Koyeb. (With a shell, `python manage.py createsuperuser`
   does the same.)
5. Sign in at `https://<koyeb host>/admin/` and `https://<koyeb host>/menu/`.

A custom domain (e.g. `api.blufinpokeco.com`) goes in both `DJANGO_ALLOWED_HOSTS` and
`DJANGO_CSRF_TRUSTED_ORIGINS`, comma-separated next to the Koyeb host.
