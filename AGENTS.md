# AGENTS.md — Guide for AI Coding Agents

This file describes the Logistics Management System project for AI coding agents.
Read this before making any change. All project documents are written in English;
write code comments, commit messages and PR descriptions in English too.

## Project overview

This is a **course project (COMP3500SEF)** built by a seven-member team: a web
application for managing shipments, inventory, hubs, delivery confirmation and
tracking enquiries. The goal is a working MVP.

**Current status (important):** the frontend and backend are **not integrated**.
Each side works against its own demo API with different routes and contracts:

| Component | Implementation |
| --- | --- |
| Frontend | React 19 + TypeScript + Vite 7 + Tailwind 4 + shadcn/ui, talking to an in-memory Node demo API (`frontend/server/server.js`) |
| Backend | Python 3 standard-library HTTP server (`backend/server.py`, zero dependencies) with SQLite persistence |
| Database | SQLite schema v1.1 (`database/schema.sql`) with Hong Kong seed data |
| Tests | Python `unittest` API tests; Node `node:test` workflow tests |
| Delivery | Dockerfile (backend only) and GitHub Actions CI |

Do not assume the two APIs are interchangeable — integration is planned future
work and their contracts deliberately differ today.

## Repository layout

```text
.
├── backend/server.py        # Python stdlib HTTP server (SQLite, port 8000)
├── database/schema.sql      # SQLite schema v1.1 + seed data (6 tables)
├── docs/openapi.yaml        # OpenAPI 3.0 spec for the Python backend API
├── docs/PROJECT.md          # Team responsibilities, milestones, task templates
├── frontend/
│   ├── src/                 # React app (pages, components, api, stores, mock)
│   ├── server/server.js     # In-memory Node demo API (port 8080)
│   ├── tests/workflow.test.ts  # Node test-runner workflow tests
│   └── package.json
├── tests/                   # Python unittest suite (backend + examples)
├── Dockerfile               # python:3.12-slim, runs backend/server.py
└── .github/workflows/ci.yml # CI: Python tests + Docker health check + frontend
```

## Build and run commands

Run from the repository root. On Windows use `py -3`, on macOS/Linux `python3`.

**Backend (Python, no package installation needed — stdlib only):**

```powershell
py -3 backend/server.py          # serves on http://localhost:8000
```

- Loads `database/schema.sql` into `backend/lms.db` on first start only.
- Env vars: `LMS_HOST` (default `localhost`; Docker sets `0.0.0.0`),
  `LMS_DB_PATH` (default `backend/lms.db`).
- If the DB was built on the old four-table schema, delete `backend/lms.db`
  so schema v1.1 is recreated.

**Frontend (Node.js ≥ 22.12):**

```powershell
cd frontend
npm ci
npm run server   # terminal 1: in-memory demo API on port 8080
npm run dev      # terminal 2: Vite dev server on http://localhost:3000
```

Sign in with `demo` / `demo123`. Vite proxies `/api` to `127.0.0.1:8080`.
`VITE_USE_MOCK=true` (see `frontend/.env.example`) switches to a browser-only
mock (`frontend/src/mock/index.ts`) with no Node server needed.

**Docker (backend only):**

```sh
docker build -t logistics-system:local .
docker run --rm -p 127.0.0.1:8000:8000 logistics-system:local
```

## Test commands

**Python (from repo root):**

```powershell
py -3 -m unittest discover -s tests -v
```

Backend tests start a real server on an ephemeral port (`port=0`) in a daemon
thread, use a temporary database, and exercise the HTTP API over the wire with
`urllib` (proxies bypassed via `ProxyHandler({})`). `tests/test_example.py` is a
minimal template testing a pure `calc_freight` function.

**Frontend (from `frontend/`):**

```powershell
npm test                                # tsc type-check + node:test via tsx
npm run lint -- --max-warnings=0
npm run build
```

`frontend/tests/workflow.test.ts` runs the same suite twice — once against the
real Node demo API (spawned as a child process on a random port) and once
against the browser mock via `matchMock`. There are no React component tests;
coverage targets the API workflow contract only.

Expect all of the above to pass before opening a PR. CI (`.github/workflows/ci.yml`)
runs on push/PR to `main`: the Python suite, a Docker build + container health
check, and the frontend lint/test/build job (Node 24, `npm ci`).

## Backend architecture (`backend/server.py`)

- **Zero dependencies**: `http.server.BaseHTTPRequestHandler` + `HTTPServer`,
  manual path dispatching in `do_GET`/`do_POST`/`do_PATCH`; `do_OPTIONS` handles
  CORS preflight. No web framework, no `requirements.txt`/`pyproject.toml` —
  this is intentional.
- **SQLite**: `database_connection()` context manager — one connection per
  request, `row_factory = sqlite3.Row`, `PRAGMA foreign_keys = ON`, `with
  connection:` for commit. Schema is seeded once when the `shipments` table is
  missing.
- **Endpoints** (see `docs/openapi.yaml` for the full contract):
  `GET /api/health`, `POST /api/auth/login`, `GET /api/shipments`,
  `GET /api/items`, `POST /api/shipments` (transactional stock deduction,
  409 on insufficient stock), `PATCH /api/shipments/{id}/status`,
  `POST /api/shipments/{id}/events` (append-only).
- **Auth is temporary by design**: hardcoded `demo`/`demo123` credentials;
  login returns a `secrets.token_urlsafe(32)` bearer token stored in an
  in-memory `set` (tokens die on restart; `password_hash` in the DB is not yet
  used). Formal authentication is planned work.
- **Validation conventions**: strict JSON bodies — exact field-set match,
  `Content-Type: application/json` (else 415), `MAX_BODY_BYTES = 65536` (413),
  `Transfer-Encoding` rejected, positive 64-bit-int helper, trimmed non-empty
  required text. Errors flow through a custom `APIError` with HTTP codes;
  `sqlite3.Error` maps to 500.

## Database (`database/schema.sql`)

Schema v1.1, six tables: `users`, `hubs`, `items`, `shipments`,
`shipment_items`, `tracking_events` (with lookup index), plus Hong Kong seed
data (3 users, 3 hubs, 3 items, 1 shipment with tracking events). The script
starts with `DROP TABLE IF EXISTS`, so re-running it rebuilds seed data. Only
SQLite is verified; CI and the backend both use it.

## Frontend architecture (`frontend/src/`)

- **Stack**: React 19, TypeScript `strict: true` (with `noUnusedLocals`,
  `verbatimModuleSyntax`, `erasableSyntaxOnly`, bundler resolution), Vite 7,
  Tailwind 4, shadcn/ui (style "new-york") on Radix primitives, react-router 7,
  zustand 5 (persist store key `lms-auth`), react-hook-form + zod, sonner
  toasts, recharts.
- **Module map**:
  - `src/api/index.ts` — typed API groups (`authApi`, `orderApi`,
    `inventoryApi`, `waybillApi`) over a generic `request<T>()` in
    `src/lib/request.ts`, which unwraps the `{code, message, data}` envelope
    (nonzero code throws `ApiError`), reads the token from localStorage key
    `lms-auth`, and hard-redirects to `/login` on 401.
  - `src/types/index.ts` — shared TS contracts (doc-commented interfaces).
  - `src/stores/auth.ts` — zustand persisted auth store; `src/mock/index.ts` —
    browser-only mock (seeded PRNG `mulberry32`, deterministic data).
  - `src/pages/` — `Login`, `Orders`, `Inventory`, `Waybills`,
    `order-dialogs`, `ComingSoon` (placeholder routes: dashboard, tracking,
    fleet, customers, settings).
  - `src/components/ui/` — ~60 generated shadcn/ui components; treat these as
    vendored (ESLint disables `react-refresh/only-export-components` there).
- **Routing** (`src/App.tsx`): `/login` is public; `RequireAuth` guards an
  `AppLayout` group and redirects to `/login` preserving `from`; `/` and `*`
  redirect to `/orders`.
- **Node demo API** (`frontend/server/server.js`): plain `node:http` (no
  Express), ESM, port from `PORT` env (default 8080). Hand-rolled routing keyed
  `"METHOD /api/v1/path"`, `{code, message, data}` envelope, business errors
  use nonzero codes (e.g. `2003` = insufficient stock) with HTTP 200, sessions
  in a `Map` with 8 h TTL, in-memory data (lost on restart). Waybill creation
  deducts stock; cancelling restores it exactly once; reactivation re-checks
  stock.

## Code style guidelines

- **Python**: 4-space indent, `snake_case`, docstrings on public functions,
  module docstring with run instructions. Stdlib only — do not add third-party
  dependencies to the backend without team agreement.
- **TypeScript/React**: `@/` path alias for `src` imports; external libraries
  first; use `import type` (required by `verbatimModuleSyntax`); function
  components with hooks; named default exports per page (`Orders`, `Login`, …);
  classnames composed with `cn` from `@/lib/utils`; user-facing errors surfaced
  via `toast.error`; guard async effects against race conditions (see the
  `requestId` ref pattern in `src/pages/Orders.tsx`).
- Type-check with `tsc` is part of `npm test` and `npm run build` — unused
  locals/params fail the build; keep imports clean.
- Keep changes minimal and focused; follow the existing file organization when
  adding features.

## Testing instructions

- Add/extend tests in `tests/` (Python) following the existing patterns:
  ephemeral-port server, temporary DB, `APIClient.request()` helper,
  `subTest` for parameterized cases, `patch.dict(os.environ, ...)` for env.
- Add/extend frontend workflow tests in `frontend/tests/workflow.test.ts` via
  the `Call` abstraction so assertions run against both the real API and the
  mock. Run `npm test` and `npm run lint -- --max-warnings=0` before committing.
- The example tests (`tests/test_example.py`) are a style template, **not**
  business coverage — do not claim workflow coverage from them.

## Security considerations

- Demo credentials `demo`/`demo123` are hardcoded in both demo APIs and are
  temporary by design; backend tokens are process-local and lost on restart.
  Do not treat the current auth as production-grade.
- CORS is `Access-Control-Allow-Origin: *` on both servers.
- Never commit passwords, access tokens or private personal data; check staged
  files before committing (see CONTRIBUTING.md).
- Backend hardening already present: body size limit, strict JSON/field
  validation, bounded integers, parameterized SQL only. Preserve these
  properties when modifying request handling.

## Contribution and deployment process

- Workflow: short-lived task branch from up-to-date `main` (names like
  `feature/order-list`, `fix/order-validation`, `docs/update-readme`), PR back
  to `main`, **at least one other team member's approval** required, author
  cannot self-approve. Fill in `.github/pull_request_template.md` with the
  linked task, actual validation commands/results, documentation impact and
  requested reviewers (include module owners for affected modules).
- Keep responsibilities and milestones in `docs/PROJECT.md`; use English for
  all project documents, commit messages and PR descriptions.
- Deployment: no automated deployment exists yet. The Dockerfile builds the
  backend image; GitHub Actions verifies the Docker build and container health
  endpoint on every push/PR to `main`.
- If you modify anything described in this file (structure, commands,
  conventions), update this `AGENTS.md` in the same PR.
