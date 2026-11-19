# -*- coding: utf-8 -*-
"""Regenerate the machine-readable integration test dataset.

Run from the repository root:

    python integration-test-dataset/generate_dataset.py

Writes 04-baseline-data.sql (idempotent SQLite load script) and
05-baseline-data.json (the same rows as JSON) into this folder.

Both are generated from the single source of truth below, so they cannot drift
apart. Hashes are deterministic (salt derived from user_id) and use the real
PBKDF2-SHA256 scheme from backend/server.py.

TEST DATA ONLY: never reuse these accounts, salts or passwords outside a
disposable local integration database.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent

PASSWORD = "It@2026Test"
ITERATIONS = 600_000
ID_LOW, ID_HIGH = 101, 199

SCHEMA_BASELINE = "database/schema.sql v1.2 (PRAGMA user_version = 2)"
API_BASELINE = "docs/openapi.yaml 0.3.0"


def make_password_hash(user_id: int) -> str:
    """Mirror backend/server.py:hash_password with a deterministic test salt."""
    salt = f"{user_id:032x}"  # 16 bytes as 32 hex characters
    digest = hashlib.pbkdf2_hmac(
        "sha256", PASSWORD.encode("utf-8"), bytes.fromhex(salt), ITERATIONS
    ).hex()
    return f"pbkdf2_sha256${ITERATIONS}${salt}${digest}"


USERS = [
    {"user_id": 101, "username": "it_customer_amy",  "role": "customer",         "phone": "+852-90100001", "business_role": "Customer / end buyer"},
    {"user_id": 102, "username": "it_customer_bob",  "role": "customer",         "phone": "+852-90100002", "business_role": "Customer / end buyer"},
    {"user_id": 103, "username": "it_merchant_ken",  "role": "warehouse_admin",  "phone": "+852-90100101", "business_role": "Merchant / shipper"},
    {"user_id": 104, "username": "it_merchant_lily", "role": "warehouse_admin",  "phone": "+852-90100102", "business_role": "Merchant / shipper"},
    {"user_id": 105, "username": "it_driver_dan",    "role": "courier",          "phone": "+852-90100201", "business_role": "Driver / courier"},
    {"user_id": 106, "username": "it_driver_eva",    "role": "courier",          "phone": "+852-90100202", "business_role": "Driver / courier"},
    {"user_id": 107, "username": "it_customer_edge", "role": "customer",         "phone": "+852-90100003", "business_role": "Customer / end buyer (boundary)"},
]
for _u in USERS:
    _u["password_hash"] = make_password_hash(_u["user_id"])

HUBS = [
    {"hub_id": 101, "hub_name": "IT Kowloon Test Hub", "district": "Kowloon",           "address": "Unit 1, 88 Test Street, Kwun Tong"},
    {"hub_id": 102, "hub_name": "IT Central Test Hub", "district": "Hong Kong Island",  "address": "Unit 2, 12 Test Road, Central"},
    {"hub_id": 103, "hub_name": "IT Shatin Test Hub",  "district": "New Territories",   "address": "Unit 3, 6 Test Lane, Shatin"},
]

# Non-ASCII (accented Latin) values exercise the UTF-8 round trip without
# introducing any non-English text into the documents.
ITEMS = [
    {"item_id": 101, "item_name": "Integration Test Mouse",      "sku": "IT-WM-101", "stock_quantity": 120, "unit_price": 150.00},
    {"item_id": 102, "item_name": "Integration Test Keyboard",   "sku": "IT-KB-102", "stock_quantity": 45,  "unit_price": 480.00},
    {"item_id": 103, "item_name": "Integration Test Cable",      "sku": "IT-CB-103", "stock_quantity": 300, "unit_price": 65.00},
    {"item_id": 104, "item_name": "Integration Low Stock Item",  "sku": "IT-LS-104", "stock_quantity": 1,   "unit_price": 99.00},
    {"item_id": 105, "item_name": "Integration Zero Stock Item", "sku": "IT-ZS-105", "stock_quantity": 0,   "unit_price": 10.00},
    {"item_id": 106, "item_name": "Café Éclat / Unicode Item",   "sku": "IT-UN-106", "stock_quantity": 10,  "unit_price": 88.50},
]

SHIPMENTS = [
    {"shipment_id": 101, "tracking_number": "IT-2026-0001", "sender_id": 103, "receiver_name": "Amy Chan",   "receiver_phone": "+852-90101001", "delivery_address": "Flat A, 8/F, Test Building, Wan Chai",     "status": "pending",   "current_hub_id": None, "created_at": "2026-11-19 01:00:00", "updated_at": "2026-11-19 01:00:00"},
    {"shipment_id": 102, "tracking_number": "IT-2026-0002", "sender_id": 103, "receiver_name": "Bob Wong",   "receiver_phone": "+852-90101002", "delivery_address": "Flat B, 12/F, Nathan Tower, Mong Kok",      "status": "shipped",   "current_hub_id": 101,  "created_at": "2026-11-19 01:05:00", "updated_at": "2026-11-19 01:15:00"},
    {"shipment_id": 103, "tracking_number": "IT-2026-0003", "sender_id": 104, "receiver_name": "Carol Lee",  "receiver_phone": "+852-90101003", "delivery_address": "Shop 3, Shatin Plaza, Shatin",              "status": "delivered", "current_hub_id": 103,  "created_at": "2026-11-19 01:10:00", "updated_at": "2026-11-19 01:40:00"},
    {"shipment_id": 104, "tracking_number": "IT-2026-0004", "sender_id": 103, "receiver_name": "José García / Unicode Receiver", "receiver_phone": "+852-90101004", "delivery_address": "Flat B, 12/F, Élan Court, Mong Kok", "status": "pending", "current_hub_id": None, "created_at": "2026-11-19 01:25:00", "updated_at": "2026-11-19 01:25:00"},
    {"shipment_id": 105, "tracking_number": "IT-2026-0005", "sender_id": 104, "receiver_name": "Daisy Ho",   "receiver_phone": "+852-90101005", "delivery_address": "Flat C, Test Court, Central",              "status": "pending",   "current_hub_id": None, "created_at": "2026-11-19 01:30:00", "updated_at": "2026-11-19 01:30:00"},
]

# UNIQUE (shipment_id, item_id) is respected. Row 104 keeps a historical price
# (145.00) below the catalogue price (150.00) to assert the v1.2 price snapshot.
SHIPMENT_ITEMS = [
    {"shipment_item_id": 101, "shipment_id": 101, "item_id": 101, "quantity": 2, "unit_price": 150.00},
    {"shipment_item_id": 102, "shipment_id": 102, "item_id": 102, "quantity": 1, "unit_price": 480.00},
    {"shipment_item_id": 103, "shipment_id": 102, "item_id": 103, "quantity": 3, "unit_price": 65.00},
    {"shipment_item_id": 104, "shipment_id": 103, "item_id": 101, "quantity": 1, "unit_price": 145.00},
    {"shipment_item_id": 105, "shipment_id": 104, "item_id": 106, "quantity": 1, "unit_price": 88.50},
    {"shipment_item_id": 106, "shipment_id": 105, "item_id": 104, "quantity": 1, "unit_price": 99.00},
]

TRACKING_EVENTS = [
    {"event_id": 101, "shipment_id": 101, "hub_id": None, "status": "pending",   "description": "Shipping order created by sender.",                                    "event_time": "2026-11-19 01:00:00"},
    {"event_id": 102, "shipment_id": 102, "hub_id": None, "status": "pending",   "description": "Shipping order created by sender.",                                    "event_time": "2026-11-19 01:05:00"},
    {"event_id": 103, "shipment_id": 102, "hub_id": 101,  "status": "shipped",   "description": "Parcel picked up by driver at IT Kowloon Test Hub.",                  "event_time": "2026-11-19 01:15:00"},
    {"event_id": 104, "shipment_id": 103, "hub_id": None, "status": "pending",   "description": "Shipping order created by sender.",                                    "event_time": "2026-11-19 01:10:00"},
    {"event_id": 105, "shipment_id": 103, "hub_id": 101,  "status": "shipped",   "description": "Departed IT Kowloon Test Hub; handed to driver.",                     "event_time": "2026-11-19 01:20:00"},
    {"event_id": 106, "shipment_id": 103, "hub_id": 103,  "status": "delivered", "description": "Delivered at IT Shatin Test Hub; proof of delivery recorded (test).",  "event_time": "2026-11-19 01:40:00"},
    {"event_id": 107, "shipment_id": 104, "hub_id": None, "status": "pending",   "description": "Non-ASCII receiver data accepted and order created.",                 "event_time": "2026-11-19 01:25:00"},
    {"event_id": 108, "shipment_id": 105, "hub_id": None, "status": "pending",   "description": "Low-stock boundary order created.",                                    "event_time": "2026-11-19 01:30:00"},
]

TABLES = [
    ("users",           ["user_id", "username", "password_hash", "role", "phone"], USERS),
    ("hubs",            ["hub_id", "hub_name", "district", "address"], HUBS),
    ("items",           ["item_id", "item_name", "sku", "stock_quantity", "unit_price"], ITEMS),
    ("shipments",       ["shipment_id", "tracking_number", "sender_id", "receiver_name", "receiver_phone", "delivery_address", "status", "current_hub_id", "created_at", "updated_at"], SHIPMENTS),
    ("shipment_items",  ["shipment_item_id", "shipment_id", "item_id", "quantity", "unit_price"], SHIPMENT_ITEMS),
    ("tracking_events", ["event_id", "shipment_id", "hub_id", "status", "description", "event_time"], TRACKING_EVENTS),
]

# Child-first deletion; the backend enables PRAGMA foreign_keys = ON.
DELETE_ORDER = {
    "tracking_events": "event_id",
    "shipment_items": "shipment_item_id",
    "shipments": "shipment_id",
    "items": "item_id",
    "hubs": "hub_id",
    "users": "user_id",
}


def sql_literal(value) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "1" if value else "0"
    if isinstance(value, float):
        return repr(value)
    if isinstance(value, int):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def build_sql() -> str:
    out = [
        "-- Integration test dataset | generated by generate_dataset.py",
        f"-- Schema baseline: {SCHEMA_BASELINE}",
        f"-- API baseline:    {API_BASELINE}",
        "--",
        "-- Load into a DISPOSABLE database only, after the backend created the",
        "-- schema and the demo account. Never run against a shared database.",
        "--   sqlite3 \"$LMS_DB_PATH\" \".read 'integration-test-dataset/04-baseline-data.sql'\"",
        "-- Idempotent: IDs 101-199 are deleted and re-inserted; seed rows and",
        "-- the demo account are never touched.",
        "",
        "BEGIN IMMEDIATE;",
        "",
    ]
    for table, id_col in DELETE_ORDER.items():
        out.append(f"DELETE FROM {table} WHERE {id_col} BETWEEN {ID_LOW} AND {ID_HIGH};")
    out.append("")
    for table, columns, rows in TABLES:
        out.append(f"-- {table} ({len(rows)} rows)")
        out.append(f"INSERT INTO {table} ({', '.join(columns)}) VALUES")
        for i, row in enumerate(rows):
            values = ", ".join(sql_literal(row[c]) for c in columns)
            out.append(f"  ({values})" + (";" if i == len(rows) - 1 else ","))
        out.append("")
    out += [
        "COMMIT;",
        "",
        "-- Verify: 7 / 3 / 6 / 5 / 6 / 8 rows in the 101-199 band.",
        "-- PRAGMA integrity_check;  PRAGMA foreign_key_check;",
        "",
    ]
    return "\n".join(out)


def build_json() -> str:
    payload = {
        "dataset": "COMP3500SEF Logistics Management System - integration test dataset",
        "folder": "integration-test-dataset",
        "version": "1.0.0",
        "status": "prepared, not executed",
        "schema_baseline": SCHEMA_BASELINE,
        "api_baseline": API_BASELINE,
        "id_range": [ID_LOW, ID_HIGH],
        "isolation": {
            "rule": "explicit IDs in 101-199; IT- prefixed SKUs and tracking numbers",
            "never_modify": ["schema.sql seed rows 1-3", "startup-created demo account"],
        },
        "login": {
            "password": PASSWORD,
            "hash_format": "pbkdf2_sha256$600000$<32-hex-salt>$<64-hex-digest>",
            "hash_note": "Deterministic test salts, NOT production-safe.",
        },
        "role_mapping": {
            "Customer / end buyer": "customer",
            "Merchant / shipper": "warehouse_admin (schema v1.2 has no merchant role)",
            "Driver / courier": "courier",
        },
        "record_counts": {name: len(rows) for name, _, rows in TABLES},
        "tables": {name: rows for name, _, rows in TABLES},
    }
    return json.dumps(payload, ensure_ascii=False, indent=2) + "\n"


if __name__ == "__main__":
    sql_path = HERE / "04-baseline-data.sql"
    json_path = HERE / "05-baseline-data.json"
    sql_path.write_text(build_sql(), encoding="utf-8")
    json_path.write_text(build_json(), encoding="utf-8")
    print("Wrote", sql_path.name, "|", json_path.name)
    print("Record counts:", {name: len(rows) for name, _, rows in TABLES})
