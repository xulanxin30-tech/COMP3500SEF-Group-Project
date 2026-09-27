# Logistics Management System

**COMP3500SEF course project | Seven-member team**

This project aims to build a web application for managing orders, inventory,
transport dispatch, delivery confirmation and shipment enquiries. The intended
course outcome is a working MVP supported by requirements, design, implementation
and testing evidence.

## Current status

The repository is an initial example skeleton. The components below can be
checked separately; the complete logistics workflow has not been implemented.

| Component | Available now | Work still planned |
| --- | --- | --- |
| Frontend | Static HTML, CSS and JavaScript; a sign-in form with an alert button | Authentication, business screens and API integration |
| Backend | Python standard-library HTTP server with two GET endpoints and fixed example orders | Business operations, validation, authentication and persistence |
| Database | SQL definitions for four tables and two sample inserts; checked with SQLite | Database selection, application integration and a migration approach |
| Tests | HTTP API and listen-address regression tests; three freight examples | Database, frontend and complete user-workflow tests |
| Delivery | Source files, team documentation, Dockerfile and GitHub Actions build/test workflow | Deployment and release automation |

There is no database connection in the backend and no API call in the active
frontend code. The sign-in form does not check credentials. Passing the example
tests does not demonstrate that the planned business features work.

## Documentation

- [Contributing guide](CONTRIBUTING.md): task setup, local development, browser
  editing and the branch/PR workflow.
- [Team Code of Conduct](CODE_OF_CONDUCT.md): proposed responsibilities,
  communication, academic integrity and concern handling; awaiting team agreement.
- [Project record](docs/PROJECT.md): member responsibilities, provisional
  milestones and task, progress and decision templates.
- [Former code-template document](CODE.md): navigation retained for older links.

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
│   ├── index.html
│   ├── style.css
│   └── app.js
├── backend/
│   └── server.py
├── database/
│   └── schema.sql
└── tests/
    ├── test_backend.py
    └── test_example.py
```

## Run the examples locally

Use a browser and Python 3. The backend and tests use only the Python standard
library; no package installation is needed. The examples have been checked with
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

### Frontend

Open the local [frontend/index.html](frontend/index.html) file in your browser.
Entering a username and clicking the sign-in button displays a welcome alert;
leaving the username empty displays a prompt. The password field has no effect.
This example can be viewed without starting the backend.

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
| [GET /api/orders](http://localhost:8000/api/orders) | HTTP 200; a JSON array of two fixed orders with `id`, `customer` and `status` fields |
| Any other GET path, for example `/missing` | HTTP 404; `{"error": "not found"}` |

These are the currently implemented routes, not an agreed contract for future
business features. Stop the server with **Ctrl+C**. If port 8000 is already in
use, stop the conflicting local server before retrying.

The server listens on `localhost` by default. Set the `LMS_HOST` environment
variable to choose another listen address.

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

Expect eight passing tests. Five exercise the production backend's health,
orders and missing-path responses and its default/configurable listen address.
The API tests use a temporary local server on an automatically assigned port.
The other three cover positive, zero and negative weight in the sample
`calc_freight` function defined inside the test file. They do not establish
coverage of database integration, the frontend or a production freight calculation.

GitHub Actions runs the suite for pushes and PRs targeting `main`, builds the
Docker image, starts the backend container and checks the health response through
the published port. A startup or port-mapping failure fails CI; container logs
are collected and the container is removed after the check.

### Optional database check

With the SQLite CLI installed, this command works in PowerShell and common Unix
shells. It loads the schema into a temporary, in-memory database and prints the
tables and seed records:

```sh
sqlite3 ":memory:" ".read database/schema.sql" ".tables" "SELECT name FROM customers;" "SELECT product, quantity FROM inventory;"
```

Expect `customers`, `inventory`, `orders` and `transport`, one customer named
`Alice`, and one stock item `Widget A` with quantity `100`. The database disappears
when the command exits and is not used by the backend.

The script's sample inserts add more rows if run again against the same database.
Use a fresh database for this check. MySQL and PostgreSQL execution has not been
verified; the final application database is still to be agreed.

## Working together

Use a short-lived task branch from an up-to-date `main`, then open a pull request
back to `main`. Every PR needs review and approval from at least one other team
member. Follow the [contributing guide](CONTRIBUTING.md) for the complete process.

Keep responsibilities and scheduling information in the [project record](docs/PROJECT.md).
Its dates, presentation duration and Logbook expectations are provisional until
checked against the official course brief.
