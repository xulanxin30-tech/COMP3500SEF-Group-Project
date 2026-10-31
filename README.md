# Logistics Management System

**COMP3500SEF course project | Seven-member team**

This project aims to build a web application for managing shipments, inventory,
hubs, delivery confirmation and tracking enquiries. The intended
course outcome is a working MVP supported by requirements, design, implementation
and testing evidence.

## Current status

The React frontend and Python backend share SQLite persistence for login,
inventory, shipment creation and status updates. Remaining logistics modules
are still planned.

| Component | Available now | Work still planned |
| --- | --- | --- |
| Frontend | React/TypeScript screens for sign in, orders, inventory and waybills, connected to Python/SQLite | Remaining logistics modules |
| Backend | Python standard-library HTTP server with SQLite users, password hashing and schema v1.2 persistence | Production session management and role permissions |
| Database | SQLite schema v1.2 (`users`, `hubs`, `items`, `shipments`, `shipment_items`, `tracking_events`), Hong Kong seed data, migration and backup tools | Database selection beyond SQLite |
| Tests | Python HTTP API tests and freight examples; frontend API workflow tests against Python/SQLite | Automated browser regression tests |
| Delivery | Source files, team documentation, Dockerfile and GitHub Actions build/test workflow | Deployment and release automation |

The backend loads `database/schema.sql` into SQLite on first start.
Automatic initialization requires an unversioned database with no user-defined
schema objects. An incomplete database or unsupported schema version stops startup
before the server listens or adds the demo account, preserving existing data.
Back up and inspect a rejected database; startup does not repair or rebuild it.
The frontend calls the same API under `/api`. Orders and waybills show the same
`shipments` records. Creating a waybill deducts stock in one SQLite transaction;
status options match schema v1.2: `pending`, `shipped`, `delivered`.
The backend adds a `demo` user with a salted PBKDF2 password hash on first start
if that account is missing, including for existing v1.1 databases.

## Documentation

- [Contributing guide](CONTRIBUTING.md): task setup, local development, browser
  editing and the branch/PR workflow.
- [Team Code of Conduct](CODE_OF_CONDUCT.md): proposed responsibilities,
  communication, academic integrity and concern handling; awaiting team agreement.
- [Project record](docs/PROJECT.md): member responsibilities, provisional
  milestones and task, progress and decision templates.
- [Former code-template document](CODE.md): navigation retained for older links.
- [Database guide](database/README.md): v1.1 migration, backup, restore and integrity checks.
- [P2 mockup plan](docs/ui/p2-mockups.md): current screen scope, proposed designs
  and usability/handover checklists; design assets and reviews are pending.
- [Manual test plan](docs/ui/docs/test/test-cases.md): current workflow cases and
  future feature blockers; execution results are not yet recorded.

## Repository layout

```text
.
├── .github/
│   ├── pull_request_template.md
│   └── workflows/
│       └── ci.yml
├── .gitignore
├── Dockerfile
├── README.md
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
├── CODE.md
├── docs/
│   └── PROJECT.md
├── frontend/
│   ├── src/
│   ├── tests/
│   └── package.json
├── backend/
│   └── server.py
├── database/
│   └── schema.sql
└── tests/
    ├── test_backend.py
    └── test_example.py
```

## Run the examples locally

Use a browser, Python 3 and Node.js 22.12 or later. The backend and Python tests
use only the Python standard library; no Python package installation is needed.
The Python examples have been checked with
Python 3.12. Git is needed for the contribution workflow. The optional database
check also needs the SQLite command-line tool, `sqlite3`.

Run commands from the repository root, the folder containing this README.
Windows examples use `py -3`; macOS/Linux examples use `python3`. If your Python 3
installation uses another command, substitute that executable. Check that it
starts successfully before continuing:

| Environment | Check interpreter |
| --- | --- |
| Windows PowerShell | `py -3 --version` |
| macOS/Linux terminal | `python3 --version` |

### One-command Windows startup

From the repository root in Windows PowerShell 5.1 or PowerShell 7, run:

```powershell
.\start.ps1
```

Install Python 3 and Node.js 22.12 or later first. The script finds `py`, `python`
or `python3`, runs `npm ci` with the lockfile, starts both servers and opens
http://127.0.0.1:3000 after the frontend, backend and API proxy are ready.
Sign in with `demo` / `demo123`. This starts local development servers, not a
production deployment.

Keep the launching terminal open. Press **Enter** or **Ctrl+C** there to stop both
servers. Startup failures also clean up the processes started by the script;
logs are saved under `output/startup/`. Ports 8000 and 3000 must be free: the
script refuses an existing listener instead of reusing it or moving Vite to a
different port. It binds the local pair to `127.0.0.1` and uses `/api`, temporarily
overriding `LMS_HOST` and `VITE_API_BASE_URL` and restoring them on exit.
`LMS_DB_PATH` is still respected; the default database is `backend/lms.db`.

Optional switches:

- `-PythonExecutable 'C:\path\to\python.exe'`: select an interpreter; the `PYTHON`
  environment variable is also supported.
- `-SkipInstall`: reuse an existing frontend installation. Use only after a
  successful `npm ci` with the current lockfile; omit after dependency changes.
- `-NoBrowser`: start without opening a browser.

If your PowerShell execution policy blocks a downloaded script, review the file
and follow your machine's policy for running local scripts, or use the separate
frontend/backend commands below.

### Frontend

Start the Python backend as described below. Use Node.js 22.12 or later,
then run `cd frontend`, `npm ci` and `npm run dev` in a second terminal.
Open http://localhost:3000 and sign in with `demo` / `demo123`.
See the [frontend guide](frontend/README.md) for API configuration and validation.
Opening `index.html` directly does not start the React application.

### Backend

Windows PowerShell:

```powershell
py -3 backend/server.py
```

macOS/Linux:

```sh
python3 backend/server.py
```

Keep that terminal open and visit the endpoints in a browser:

| Request | Expected response |
| --- | --- |
| [GET /api/health](http://localhost:8000/api/health) | HTTP 200; `{"status": "ok", "service": "lms-backend"}` |
| [GET /api/shipments](http://localhost:8000/api/shipments) | HTTP 200; seeded shipment `HK202610001` for sender `customer_alice` |
| [GET /api/items](http://localhost:8000/api/items) | HTTP 200; seeded catalogue including `TECH-WM-001` |
| Any other GET path, for example `/missing` | HTTP 404; `{"error": "not found"}` |

Authenticated writes (`POST /api/auth/login`, `POST /api/shipments`,
`PATCH /api/shipments/{id}/status`, `POST /api/shipments/{id}/events`) are
documented in [docs/openapi.yaml](docs/openapi.yaml). Stop the server with
**Ctrl+C**. If port 8000 is already in use, stop the conflicting local server
before retrying. For an existing v1.1 database, stop the backend, run
`python database/db_manager.py backup`, then `python database/db_manager.py migrate`
and `python database/db_manager.py verify` (substitute `py -3` on Windows).
The older four-table schema is unsupported by migration; preserve a backup before
using `rebuild` if its data is disposable.

The server listens on `localhost` by default. Set `LMS_HOST` to choose another
listen address and `LMS_DB_PATH` to choose the SQLite file (default:
`backend/lms.db`). The demo account is `demo` / `demo123`; login reads `users`
and returns its id, username and role. Existing placeholder seed hashes for
other users are not login credentials. Tokens expire when the backend restarts,
while users, stock, shipments and tracking events remain in SQLite.

### Backend in Docker

With Docker installed and running, build and start the backend from the
repository root:

```sh
docker build -t logistics-system:local .
docker run --rm -p 127.0.0.1:8000:8000 logistics-system:local
```

The image sets `LMS_HOST=0.0.0.0` so the server accepts requests forwarded to
the container. The published port is accessible locally at the API URLs above.
Stop the container with **Ctrl+C**.

### Tests

Windows PowerShell:

```powershell
py -3 -m unittest discover -s tests -v
```

macOS/Linux:

```sh
python3 -m unittest discover -s tests -v
```

Expect the unittest suite to pass. The backend tests exercise health, seeded
shipments, inventory deduction, tracking events, persistence across restart and
the default/configurable listen address. They use a temporary local server on an
automatically assigned port. Three further tests cover positive, zero and
negative weight in the sample `calc_freight` function. They do not establish
coverage of the frontend or a production freight calculation.

For frontend validation, run `npm test`, `npm run lint -- --max-warnings=0`
and `npm run build` from `frontend`. The workflow suite checks the local HTTP
React API layer against a real temporary Python/SQLite server; the
[frontend guide](frontend/README.md) describes its scope and Python configuration.

On Windows, after `npm ci` in `frontend`, run
`py -3 -m unittest discover -s tests/windows -v` to check `start.ps1` with real
Python/Vite processes. The separate suite covers startup from a path with spaces,
the API proxy, occupied ports, invalid health responses, install/server failures
and process cleanup. It uses disposable database files and does not open a browser.
Ports 8000 and 3000 must be free; local tests skip if either is already in use.
GitHub Actions runs this suite in a separate Windows job.

GitHub Actions runs the Python suite for pushes and PRs targeting `main`, builds the
Docker image, starts the backend container and checks the health response through
the published port. A startup or port-mapping failure fails CI; container logs
are collected and the container is removed after the check. A separate frontend
job installs the locked dependencies and runs lint, workflow tests and a build.

### Optional database check

With the SQLite CLI installed, this command works in PowerShell and common Unix
shells. It loads the schema into a temporary, in-memory database and prints the
tables and seed records:

```sh
sqlite3 ":memory:" ".read database/schema.sql" ".tables" "SELECT username FROM users;" "SELECT sku, stock_quantity FROM items;"
```

Expect `users`, `hubs`, `items`, `shipments`, `shipment_items` and
`tracking_events`, a user named `customer_alice`, and SKU `TECH-WM-001` with
quantity `120`. The database disappears when the command exits.

The script begins by dropping the existing tables, so re-running it against the same
file rebuilds seed data. Use a fresh database for this check. MySQL and
PostgreSQL execution has not been verified; CI and the backend use SQLite.

## Working together

Use a short-lived task branch from an up-to-date `main`, then open a pull request
back to `main`. Every PR needs review and approval from at least one other team
member. Follow the [contributing guide](CONTRIBUTING.md) for the complete process.

Keep responsibilities and scheduling information in the [project record](docs/PROJECT.md).
Its dates, presentation duration and Logbook expectations are provisional until
checked against the official course brief.
