# Yunlian Logistics frontend

React 19, TypeScript, Vite and Tailwind CSS provide the login, inventory,
order and waybill screens. Every workflow calls `backend/server.py` and uses
the same SQLite database.

## Run locally

Use Python 3 and Node.js 22.12 or later. Start the backend from the repository
root (Windows PowerShell):

```powershell
py -3 backend/server.py
```

On macOS/Linux use `python3 backend/server.py`. If Python has another executable
path, use that instead. In a second terminal:

```sh
cd frontend
npm ci
npm run dev
```

Open http://localhost:3000 and sign in with `demo` / `demo123`.
Vite dev and preview proxy `/api` to the Python backend on port 8000.
No environment file is required. For another backend address, set
`VITE_API_BASE_URL=http://127.0.0.1:8000/api` in `frontend/.env` and restart Vite.
A deployed build needs a reverse proxy for `/api` or an explicit API base URL.

The backend defaults to `backend/lms.db`; set `LMS_DB_PATH` before starting it
to select another database. Startup adds the missing demo account with a salted
PBKDF2-SHA256 hash to `users`, including in existing v1.1 databases. It preserves
existing stock, shipments and account passwords. The other seed accounts have
placeholder password hashes and cannot sign in until real hashes are assigned.

## Shared workflow

Sign in → check inventory → create a waybill → update status.
The waybill form uses the signed-in SQLite user as sender and requires a SKU,
positive integer quantity, receiver name, phone and delivery address.
The backend atomically deducts stock and writes the shipment, shipment item
and initial tracking event. Insufficient stock returns the backend's error
without creating a partial shipment.

Orders and waybills are views of the same `shipments` records, with local search,
status filtering and pagination. Lists include all items on each shipment.
Status options are `pending`, `shipped` and `delivered`, matching schema v1.1.
Changing status appends a tracking event; it does not change inventory.
The schema has no cancellation status or separate order table.

Users, stock, shipments and events persist across backend restarts.
Bearer tokens are process-local; after a restart, an authenticated request
returns 401 and the frontend clears the session and redirects to sign in.
Incorrect login credentials stay on the login page and show the backend error.
Sessions issued by the former Node demo are discarded by the new auth-store
version. The Node demo and browser mock have been removed.

## API contract

| Method | Path | Behavior |
| --- | --- | --- |
| POST | `/api/auth/login` | Verify a SQLite password hash; return token and public user |
| GET | `/api/auth/profile` | Current SQLite user; requires a bearer token |
| GET | `/api/items` | Catalogue, actual stock and unit prices in HKD |
| GET | `/api/shipments` | Persisted shipments with receiver details, timestamps and items |
| POST | `/api/shipments` | Create a pending waybill and deduct stock atomically |
| PATCH | `/api/shipments/:id/status` | Update status and append a tracking event |

Success responses are raw JSON objects/arrays. Errors use `{ error }`
and HTTP status codes, including 409 for insufficient stock. Shipment writes
require `Authorization: Bearer <token>`. Items, shipments and health are public
reads, as documented in [OpenAPI](../docs/openapi.yaml). SQLite timestamps are UTC;
the frontend displays them in the browser's local timezone. Inventory shows only
fields stored in schema v1.1 (no invented warehouse or safety-stock values).

## Validation

```sh
npm test
npm run lint -- --max-warnings=0
npm run build
```

`npm test` type-checks the frontend and runs its actual API/request modules against
a temporary Python server and SQLite file. It checks login/profile, multi-item
shipments, creation and stock deduction, PATCH status, persistence across restart,
expired sessions, invalid inputs and competing stock requests. No manually
started server is needed; tests start and stop their own server.

Tests use `python3` on macOS/Linux and `python` on Windows by default.
Set `PYTHON` to the Python executable if needed. For example, in PowerShell:

```powershell
$env:PYTHON = 'C:\path\to\python.exe'
npm test
```

GitHub Actions installs Python for the frontend job and runs these same checks.
Run the standalone Python regression suite from the repository root with
`py -3 -m unittest discover -s tests -v` (or `python3` on macOS/Linux).

## Source layout

```text
src/api            Typed Python API calls
src/lib/request.ts JSON HTTP requests, token injection and backend errors
src/pages          Login, inventory and shared shipment views
src/types          Python/SQLite JSON contracts
tests              Frontend API workflow tests using the real backend
```
