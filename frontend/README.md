# Yunlian Logistics frontend

React 19, TypeScript, Vite and Tailwind CSS provide the order, inventory and
waybill screens. A separate Node HTTP API supports the local workflow demo.

## Run locally

Use Node.js 22.12 or later. From the repository root:

```sh
cd frontend
npm ci
npm run server
```

Keep that terminal open and start the frontend in a second terminal:

```sh
cd frontend
npm run dev
```

Open http://localhost:3000 and sign in with `demo` / `demo123`.
No `.env` file is required: Vite proxies `/api` to the local API on port 8080.
`npm run preview` also proxies API requests when checking a production build.
If the API uses a different `PORT`, set `VITE_API_BASE_URL` in a local `.env`
file to its full API address, for example `http://127.0.0.1:8081/api/v1`.
Restart Vite after changing environment variables.

The demo supports sign in → inventory → create waybill (deduct stock) → change
status → cancel (restore stock). Repeated cancellation does not restore stock
twice. Reactivation checks available stock before deducting it again.

The Node service binds to `127.0.0.1` and stores all data and sessions in memory.
Restarting it resets orders, waybills and stock, and invalidates issued tokens.
Sessions expire after eight hours. This service is separate from
`backend/server.py`: the Python/SQLite API uses different routes and data
contracts. Pointing this frontend directly at the Python API does not integrate
the two implementations. Python integration and durable demo data remain future
work.

To run without a server, copy `.env.example` to `.env`, set `VITE_USE_MOCK=true`
and restart Vite. Browser mock data resets on refresh. The header identifies
whether the app is using `MOCK` or `LOCAL API` mode.

## API contract

| Method | Path | Behavior |
| --- | --- | --- |
| POST | `/api/v1/auth/login` | Issue a demo session token |
| GET | `/api/v1/auth/profile` | Current demo user |
| GET | `/api/v1/inventory` | Stock and safety-stock levels |
| GET | `/api/v1/waybills` | List waybills |
| POST | `/api/v1/waybills` | Validate a positive integer quantity and deduct stock |
| PUT | `/api/v1/waybills/:id/status` | Update status, restoring stock on cancellation |
| GET | `/api/v1/orders` | Search, filter and paginate orders |
| GET | `/api/v1/orders/stats` | Actual order counts and delivery rate; today uses UTC |
| POST | `/api/v1/orders` | Create an order |
| PUT | `/api/v1/orders/:id/status` | Update a validated order status |

Responses use `{ code, message, data }`. A nonzero `code` is an error, including
`2003` for insufficient stock. Every endpoint except login requires an issued
`Authorization: Bearer <token>`. Invalid authentication returns HTTP 401;
malformed JSON returns 400 and oversized bodies return 413.

## Validation

```sh
npm test
npm run lint -- --max-warnings=0
npm run build
npm audit
```

The workflow suite exercises stock deduction, cancellation, reactivation,
validation, unique references, search and statistics against both the HTTP API
and browser mock. HTTP checks also cover forged tokens and malformed requests.
GitHub Actions runs the frontend checks separately from the Python backend.

Tailwind 4 replaces the vulnerable Tailwind 3 build dependency chain while
retaining the configured theme. Browser requirements and migration details are
in the [official upgrade guide](https://tailwindcss.com/docs/upgrade-guide).

## Source layout

```text
server/server.js   In-memory Node demo API
src/api           Typed API calls
src/lib/request.ts HTTP/mock selection and token injection
src/mock          Browser demo data and workflow handlers
src/pages         Login, orders, inventory and waybill screens
src/types         Shared frontend data contracts
tests             HTTP and mock workflow regression tests
```
