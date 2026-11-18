# -*- coding: utf-8 -*-
"""Regenerate the two machine-readable artefacts of the integration test dataset.

Run from any directory:

    python 联调测试数据集/generate_dataset.py

It rewrites, in this folder:
  * 04-联调基础数据.sql   - idempotent SQLite load script
  * 05-联调基础数据.json  - the same rows as JSON, for parameterised test runners

Both files are generated from the single source of truth below, so they can
never drift apart. Password hashes are deterministic: the salt is derived from
the user_id, which makes the whole dataset byte-for-byte reproducible while
still using the real PBKDF2-SHA256 scheme from backend/server.py.

TEST DATA ONLY. Never reuse these accounts, salts or passwords outside a
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
    """Mirror backend/server.py:hash_password, with a deterministic test salt."""
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

ITEMS = [
    {"item_id": 101, "item_name": "Integration Test Mouse",            "sku": "IT-WM-101", "stock_quantity": 120, "unit_price": 150.00},
    {"item_id": 102, "item_name": "Integration Test Keyboard",         "sku": "IT-KB-102", "stock_quantity": 45,  "unit_price": 480.00},
    {"item_id": 103, "item_name": "Integration Test Cable",            "sku": "IT-CB-103", "stock_quantity": 300, "unit_price": 65.00},
    {"item_id": 104, "item_name": "Integration Low Stock Item",        "sku": "IT-LS-104", "stock_quantity": 1,   "unit_price": 99.00},
    {"item_id": 105, "item_name": "Integration Zero Stock Item",       "sku": "IT-ZS-105", "stock_quantity": 0,   "unit_price": 10.00},
    {"item_id": 106, "item_name": "整合測試商品 / Unicode Item",        "sku": "IT-UN-106", "stock_quantity": 10,  "unit_price": 88.50},
]

SHIPMENTS = [
    {"shipment_id": 101, "tracking_number": "IT-2026-0001", "sender_id": 103, "receiver_name": "Amy Chan",   "receiver_phone": "+852-90101001", "delivery_address": "Flat A, 8/F, Test Building, Wan Chai", "status": "pending",   "current_hub_id": None, "created_at": "2026-11-19 01:00:00", "updated_at": "2026-11-19 01:00:00"},
    {"shipment_id": 102, "tracking_number": "IT-2026-0002", "sender_id": 103, "receiver_name": "Bob Wong",   "receiver_phone": "+852-90101002", "delivery_address": "Flat B, 12/F, Nathan Tower, Mong Kok", "status": "shipped",   "current_hub_id": 101,  "created_at": "2026-11-19 01:05:00", "updated_at": "2026-11-19 01:15:00"},
    {"shipment_id": 103, "tracking_number": "IT-2026-0003", "sender_id": 104, "receiver_name": "Carol Lee",  "receiver_phone": "+852-90101003", "delivery_address": "Shop 3, Shatin Plaza, Shatin",        "status": "delivered", "current_hub_id": 103,  "created_at": "2026-11-19 01:10:00", "updated_at": "2026-11-19 01:40:00"},
    {"shipment_id": 104, "tracking_number": "IT-2026-0004", "sender_id": 103, "receiver_name": "陳大文 / Unicode Receiver", "receiver_phone": "+852-90101004", "delivery_address": "九龍旺角測試大廈 12 樓 B 室", "status": "pending", "current_hub_id": None, "created_at": "2026-11-19 01:25:00", "updated_at": "2026-11-19 01:25:00"},
    {"shipment_id": 105, "tracking_number": "IT-2026-0005", "sender_id": 104, "receiver_name": "Daisy Ho",   "receiver_phone": "+852-90101005", "delivery_address": "Flat C, Test Court, Central",          "status": "pending",   "current_hub_id": None, "created_at": "2026-11-19 01:30:00", "updated_at": "2026-11-19 01:30:00"},
]

# UNIQUE (shipment_id, item_id) is respected: no order books the same SKU twice.
# Row 104 keeps a historical price (145.00) different from the catalogue price
# (150.00) so the v1.2 price-snapshot behaviour can be asserted.
SHIPMENT_ITEMS = [
    {"shipment_item_id": 101, "shipment_id": 101, "item_id": 101, "quantity": 2, "unit_price": 150.00},
    {"shipment_item_id": 102, "shipment_id": 102, "item_id": 102, "quantity": 1, "unit_price": 480.00},
    {"shipment_item_id": 103, "shipment_id": 102, "item_id": 103, "quantity": 3, "unit_price": 65.00},
    {"shipment_item_id": 104, "shipment_id": 103, "item_id": 101, "quantity": 1, "unit_price": 145.00},
    {"shipment_item_id": 105, "shipment_id": 104, "item_id": 106, "quantity": 1, "unit_price": 88.50},
    {"shipment_item_id": 106, "shipment_id": 105, "item_id": 104, "quantity": 1, "unit_price": 99.00},
]

TRACKING_EVENTS = [
    {"event_id": 101, "shipment_id": 101, "hub_id": None, "status": "pending",   "description": "Shipping order created by sender.",                                   "event_time": "2026-11-19 01:00:00"},
    {"event_id": 102, "shipment_id": 102, "hub_id": None, "status": "pending",   "description": "Shipping order created by sender.",                                   "event_time": "2026-11-19 01:05:00"},
    {"event_id": 103, "shipment_id": 102, "hub_id": 101,  "status": "shipped",   "description": "Parcel picked up by driver at IT Kowloon Test Hub.",                 "event_time": "2026-11-19 01:15:00"},
    {"event_id": 104, "shipment_id": 103, "hub_id": None, "status": "pending",   "description": "Shipping order created by sender.",                                   "event_time": "2026-11-19 01:10:00"},
    {"event_id": 105, "shipment_id": 103, "hub_id": 101,  "status": "shipped",   "description": "Departed IT Kowloon Test Hub; handed to driver.",                    "event_time": "2026-11-19 01:20:00"},
    {"event_id": 106, "shipment_id": 103, "hub_id": 103,  "status": "delivered", "description": "Delivered at IT Shatin Test Hub; proof of delivery recorded (test).", "event_time": "2026-11-19 01:40:00"},
    {"event_id": 107, "shipment_id": 104, "hub_id": None, "status": "pending",   "description": "Unicode receiver address accepted and order created.",                "event_time": "2026-11-19 01:25:00"},
    {"event_id": 108, "shipment_id": 105, "hub_id": None, "status": "pending",   "description": "Low-stock boundary order created.",                                   "event_time": "2026-11-19 01:30:00"},
]

TABLES = [
    ("users",           ["user_id", "username", "password_hash", "role", "phone"], USERS),
    ("hubs",            ["hub_id", "hub_name", "district", "address"], HUBS),
    ("items",           ["item_id", "item_name", "sku", "stock_quantity", "unit_price"], ITEMS),
    ("shipments",       ["shipment_id", "tracking_number", "sender_id", "receiver_name", "receiver_phone", "delivery_address", "status", "current_hub_id", "created_at", "updated_at"], SHIPMENTS),
    ("shipment_items",  ["shipment_item_id", "shipment_id", "item_id", "quantity", "unit_price"], SHIPMENT_ITEMS),
    ("tracking_events", ["event_id", "shipment_id", "hub_id", "status", "description", "event_time"], TRACKING_EVENTS),
]

# Child tables first: shipments -> hubs/users, shipment_items -> shipments/items,
# tracking_events -> shipments/hubs. Required because the backend enables
# PRAGMA foreign_keys = ON.
DELETE_ORDER = ["tracking_events", "shipment_items", "shipments", "items", "hubs", "users"]


def sql_literal(value) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "1" if value else "0"
    if isinstance(value, (int, float)):
        return repr(value) if isinstance(value, float) else str(value)
    return "'" + str(value).replace("'", "''") + "'"


def build_sql() -> str:
    out = [
        "-- Integration test dataset | 联调测试数据集 | generated by generate_dataset.py",
        f"-- Schema baseline: {SCHEMA_BASELINE}",
        f"-- API baseline:    {API_BASELINE}",
        "--",
        "-- Load into a DISPOSABLE database only, after the backend has created the",
        "-- schema and the demo account. Never run against a shared database.",
        "--",
        "--   sqlite3 \"$LMS_DB_PATH\" \".read 04-联调基础数据.sql\"",
        "--",
        "-- Idempotent: rows in the 101-199 ID band are deleted and re-inserted.",
        "-- Seed rows (1-3) and the startup-created demo account are never touched.",
        "",
        "BEGIN IMMEDIATE;",
        "",
    ]
    for table in DELETE_ORDER:
        out.append(f"DELETE FROM {table} WHERE {'event_id' if table == 'tracking_events' else ('shipment_item_id' if table == 'shipment_items' else ('shipment_id' if table == 'shipments' else ('item_id' if table == 'items' else ('hub_id' if table == 'hubs' else 'user_id'))))} BETWEEN {ID_LOW} AND {ID_HIGH};")
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
        "-- Post-load verification (expected counts: 7 / 3 / 6 / 5 / 6 / 8):",
        "-- SELECT 'users', COUNT(*) FROM users WHERE user_id BETWEEN 101 AND 199",
        "-- UNION ALL SELECT 'hubs', COUNT(*) FROM hubs WHERE hub_id BETWEEN 101 AND 199",
        "-- UNION ALL SELECT 'items', COUNT(*) FROM items WHERE item_id BETWEEN 101 AND 199",
        "-- UNION ALL SELECT 'shipments', COUNT(*) FROM shipments WHERE shipment_id BETWEEN 101 AND 199",
        "-- UNION ALL SELECT 'shipment_items', COUNT(*) FROM shipment_items WHERE shipment_item_id BETWEEN 101 AND 199",
        "-- UNION ALL SELECT 'tracking_events', COUNT(*) FROM tracking_events WHERE event_id BETWEEN 101 AND 199;",
        "-- PRAGMA integrity_check;",
        "",
    ]
    return "\n".join(out)


def build_json() -> str:
    payload = {
        "dataset": "COMP3500SEF Logistics Management System - integration test dataset",
        "chinese_name": "联调测试数据集",
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
            "username_field": "username",
            "password": PASSWORD,
            "hash_format": "pbkdf2_sha256$600000$<32-hex-salt>$<64-hex-digest>",
            "hash_note": "Generated by make_password_hash(); salts are deterministic test values, NOT production-safe.",
        },
        "role_mapping": {
            "购买物流服务的用户 / Customer (end buyer)": "customer",
            "使用物流服务的商家 / Merchant (shipper)": "warehouse_admin (schema v1.2 has no merchant role)",
            "运送货物的司机 / Driver": "courier",
        },
        "record_counts": {name: len(rows) for name, _, rows in TABLES},
        "tables": {name: rows for name, _, rows in TABLES},
    }
    return json.dumps(payload, ensure_ascii=False, indent=2) + "\n"


if __name__ == "__main__":
    sql_path = HERE / "04-联调基础数据.sql"
    json_path = HERE / "05-联调基础数据.json"
    sql_path.write_text(build_sql(), encoding="utf-8")
    json_path.write_text(build_json(), encoding="utf-8")
    print("Wrote", sql_path.name, "|", json_path.name)
    print("Record counts:", {name: len(rows) for name, _, rows in TABLES})
