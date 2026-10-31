# database/ - schema, migration and backup

Owner: CEN Yin Chi (Database Engineer). Review schema changes with the affected module
owners (see `docs/PROJECT.md`).

| File | What it is |
| :--- | :--- |
| `schema.sql` | The schema (v1.2) **and** the seed data. `backend/server.py` runs it only for an unversioned database with no user-defined schema objects. |
| `db_manager.py` | Migration / backup / clean-rebuild / verify tool. Standard library only, no dependencies. |
| `backups/` | Output of `db_manager.py backup`. Do not commit it (`*.db` and the SQL dumps contain data). |

## Commands

Run from the repository root:

```bash
python database/db_manager.py migrate    # upgrade an existing backend/lms.db to v1.2
python database/db_manager.py verify     # integrity checks; exit code 1 means stop
python database/db_manager.py backup     # binary copy + SQL dump into database/backups/
python database/db_manager.py rebuild    # delete, recreate, seed (asks for confirmation)
python database/db_manager.py status     # schema version, row counts, indexes
```

`--db PATH` points at another database file (useful for a scratch copy); `LMS_DB_PATH` is
honoured as well, like the backend.

## When to use which

| Situation | Command |
| :--- | :--- |
| `backend/lms.db` already exists and `schema.sql` changed | `migrate`, then `verify` |
| Fresh checkout, no database yet | nothing - `python backend/server.py` creates it |
| Demo database is broken and time is short | `rebuild` (a few seconds) |
| Before merging, or before a demo | `verify` |
| Weekly, or before a risky change | `backup` |

`migrate` is idempotent: running it twice changes nothing. It is also the only command that
keeps existing rows - `rebuild` throws them away.

Stop the backend before `migrate` or `rebuild`, and take a backup first. Migration supports
the six-table v1.1 schema and v1.2; incomplete databases and newer versions are rejected.
The entire upgrade runs in one transaction, including duplicate-line consolidation and
the version marker. Any failure rolls it all back. Orphan references, nonpositive order
quantities, NULL SKUs, negative stock and negative prices must be corrected explicitly;
the tool does not discard orphan rows or silently change inventory values.

Duplicate v1.1 order lines are combined by summing their quantities, preserving the
lowest line ID and the AUTOINCREMENT high-water marks. Stock is unchanged. Because v1.1
stored no historical order prices, migration backfills from the current catalogue price;
it cannot recover the original sale price. New v1.2 orders capture the price on insert.

Both backup formats use the same completed SQLite snapshot, even if the backend is
writing during backup. SQL dumps include the schema version and can be restored into an
empty database with `sqlite3.Connection.executescript`. Repeated backups receive distinct
names; `--keep N` retains the last N pairs (`0` disables pruning). Both the backend and
this tool create v1.2 databases with `PRAGMA user_version = 2`.

Backend startup checks that existing databases contain all six application tables
and a supported schema version before adding the demo account. Missing tables,
view-only databases and unsupported versions cause startup to stop without
reseeding or changing existing data. Complete v1.1 and v1.2 databases remain
supported; startup does not migrate them. Bootstrap also refuses to drop existing
objects if another initializer populates the database after the empty check.

If startup rejects a database, stop other backend processes, back it up, and run
`verify` to inspect it. Repair an incomplete database or restore a known-good
backup before retrying. Use `migrate` only for a supported complete database;
`rebuild` remains an explicit, destructive choice for disposable data.

## What v1.2 changed

1. `shipment_items.unit_price` - the price snapshot taken at order time. Filled by trigger
   `trg_shipment_items_price`, so `backend/server.py` needs no change and an explicitly
   supplied price is never overwritten.
2. Guards: `stock_quantity >= 0`, `quantity > 0`, `sku NOT NULL`, and
   `UNIQUE (shipment_id, item_id)` so one product cannot be booked twice in one order.
3. Indexes from `docs/index-plan.md`, including the `event_id` tie-break on the timeline
   index.
4. `v_shipment_order_summary` - line count, units and amount per order in one place.

Existing databases receive all of this through `migrate`: SQLite cannot add a `CHECK` or a
`UNIQUE` constraint in place, so the two tables that need them are rebuilt with the
SQLite table-rebuild procedure: disable foreign keys before beginning the transaction,
validate references, create/copy/drop/rename the tables, restore dependent objects, check
foreign keys again, commit, then re-enable enforcement. Failures roll back the transaction.

## Tests

```bash
python -m unittest discover -s tests -v
```

`tests/test_database.py` covers the schema, the guards, the price trigger, the order
summary, the index plan, migration rollback and ID preservation, backend initialization,
and binary/SQL backup restoration, consistency and retention.
