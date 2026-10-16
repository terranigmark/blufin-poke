import { defineConfig, devices } from "@playwright/test";

// Browser tests for the menu editor: the static site on :3000 talking to a
// throwaway Django backend on :8000 (fresh SQLite database each run).
const DB = "/tmp/blufin-e2e.sqlite3";

export default defineConfig({
  testDir: "e2e",
  workers: 1, // the tests share one database
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: "http://localhost:3000", trace: "retain-on-failure", ...devices["Pixel 7"] },
  webServer: [
    {
      cwd: "backend",
      command: `rm -f ${DB} && uv run python manage.py migrate -v0 && uv run python manage.py shell -c "from accounts.models import User; User.objects.create_user('gerente@blufin.mx', 'una-clave-larga-123', can_edit_menu=True); User.objects.create_superuser('duena@blufin.mx', 'una-clave-larga-123')" && uv run python manage.py runserver 8000`,
      url: "http://localhost:8000/api/menu/",
      env: { DATABASE_URL: `sqlite:///${DB}`, DJANGO_SECRET_KEY: "e2e-only-not-a-secret", DJANGO_DEBUG: "true", DJANGO_LOGIN_RATE: "100/min" },
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: "npm run build && npx serve out -l 3000",
      url: "http://localhost:3000/login/",
      env: { NEXT_PUBLIC_API_URL: "http://localhost:8000" },
      reuseExistingServer: false,
      timeout: 180_000,
    },
  ],
});
