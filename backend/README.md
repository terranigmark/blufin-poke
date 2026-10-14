# Blufin backend (Django)

| Route | Who | What |
| --- | --- | --- |
| `/admin/` | Owners (superusers) | Django Admin: create and edit accounts |
| `/menu/` | Owners and employees with **Puede editar el menú** | Menu editor: bowl sizes, ingredients, extras, tap beers, drinks |

Everyone signs in with email and password. To give an employee menu access, open
`/admin/` → Usuarios → Añadir, enter their email and a password, and tick
**Puede editar el menú**. Leave "Es staff" off so they only see the menu.

The menu starts with the items the website ships today (`src/data/menu.ts`). The
website still reads that file; serving it from here is a later step.

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

## Deploy (Koyeb + Neon)

Build from `backend/Dockerfile` (work directory `backend`). The container runs
migrations on start (`RUN_MIGRATIONS=false` skips them) and serves on `$PORT`.
Set the variables in `.env.example`: `DJANGO_SECRET_KEY`, `DATABASE_URL` (Neon),
`DJANGO_ALLOWED_HOSTS` and `DJANGO_CSRF_TRUSTED_ORIGINS` (the Koyeb host). Then
create the first owner from a Koyeb console with `python manage.py createsuperuser`.
