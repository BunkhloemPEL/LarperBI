# Project: LarperBI (React + FastAPI)

## Commands (run from repo root)
- `make setup`    install backend + frontend deps
- `make check`    ruff, pyright, pytest, tsc, biome, vitest. MUST PASS before you say "done"
- `make gen-api`  Pydantic -> openapi.json -> frontend/src/api/schema.d.ts. MUST run after any backend schema change
- `make dev`      API on :8000 and web on :5173 (Vite proxies /api)
- `make e2e`      Playwright (needs `npx playwright install chromium` once)

## Architecture
- `backend/app/models.py`: ALL API request/response shapes (Pydantic). Source of truth.
- `backend/app/semantic/models.yaml`: datasets, dimensions, measures. Add business logic HERE, not in routes.
- `backend/app/engine/`: compiles a QueryRequest to parameterized SQL and runs it on DuckDB.
- `backend/app/main.py`: thin routes only. No logic.
- `frontend/src/api/`: `schema.d.ts` is GENERATED. Never edit by hand. `client.ts` wraps openapi-fetch.
- `frontend/src/features/<name>/`: feature folders; no cross-feature imports.

## Rules
- Never hand-write API types in TypeScript. Change Pydantic, run `make gen-api`.
- Never build SQL by string-formatting user input. Identifiers come only from models.yaml; values are bound parameters.
- Every new endpoint needs a pytest. Every pure function in the frontend needs a vitest.
- Do not add dependencies without asking.
- Prefer editing existing modules over creating parallel ones.
- Work in small commits on an `agent/*` branch. Never commit to main.
- Specs live in `docs/specs/`. Read the relevant spec before implementing; if none exists, propose one first.
- Stop all running servers and background test processes (e.g. uvicorn, vite, playwright) immediately after testing finishes. Never leave ports (e.g. 8000, 8001, 5173, 5174) bound or exit with orphaned processes to avoid "address already in use" errors.

## Gotchas (append whenever you repeat a mistake)
- DuckDB connections are per-request; do not share across threads.
- Parallel worktrees share ports/DBs unless you set API_PORT (see `make worktree`).
- Leaving dev/API servers running in the background causes `Address already in use` (errno 48) on subsequent runs. Always kill them before yielding.

## Refernces
- Try to replicate feature from PowerBI and Metabase since this project is basically the better version of these two big BI tool.

## Testing policy

Every bug fix and feature must include a test that fails before and passes after.
Choose the LOWEST level that can catch the problem:

| Level | Use for | Where | Command |
|---|---|---|---|
| Unit | Pure logic: SQL compilation, chart option mapping, formatters | `backend/tests/test_*.py`, `frontend/src/**/*.test.ts` | `make check` |
| Integration | API + DuckDB + semantic layer together; React components with mocked API | `backend/tests/test_api.py`, component tests | `make check` |
| E2E | Full user flows in a real browser against the real backend | `frontend/e2e/*.spec.ts` | `make e2e` |

Rules:
- Bug fix workflow: (1) write a failing test that reproduces it, (2) show it fails,
  (3) fix, (4) show it passes. Never fix first.
- Backend logic changes -> unit/integration (pytest). Don't use E2E for what an API test can cover.
- E2E only for user-visible flows that cross frontend + backend. Keep each under ~10 lines of steps.
  Use role/label selectors (getByRole, getByLabel), never CSS classes.
- Do not weaken or delete an existing test to make it pass. If a test is wrong, explain why first.
- Final report must list: tests added, their level, and `make check` (and `make e2e` if touched) results.
