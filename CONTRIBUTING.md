# Contributing

## Every change ships with its tests

Every new or changed feature adds or updates its tests in the same pull request. A fix comes with
a test that fails without it. CI runs the whole suite on every pull request, and a failing test
blocks the merge.

## Running the tests

Website (Vitest + Testing Library; tests sit next to the code as `*.test.ts(x)`):

```bash
npm test          # all front-end tests
npm run lint      # type-check
npm run test:e2e  # Playwright browser tests in e2e/ (run `npx playwright install chromium` once first)
```

Backend (Django test runner; tests in each app's `tests.py`):

```bash
cd backend
uv run python manage.py test
```

## What CI runs

- `.github/workflows/frontend.yml`: type-check, tests and the static build.
- `.github/workflows/e2e.yml`: Playwright browser tests against a throwaway backend.
- `.github/workflows/backend.yml`: migrations check, deploy checks and tests against Postgres, plus the Docker build.
