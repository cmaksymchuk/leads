#!/usr/bin/env python3
"""
Thin feeder for LeadFlow: Manitoba Roll Entry CSV → candidates or POST /api/ingest.

Business logic stays in the Next.js app; this script only maps, filters, and sends HTTP.
"""

from __future__ import annotations

import argparse
import hashlib
import os
import sys
from pathlib import Path

import pandas as pd
import requests
from dotenv import load_dotenv

# Manitoba Open Data → internal column names
MB_COLUMN_MAP = {
    "PROPERTY_ADDRESS": "address",
    "MUNI_NAME_WITH_TYP": "city",
    "POSTAL_CODE": "postal_code",
}

ENRICHED_COLUMNS = [
    "address",
    "city",
    "postal_code",
    "contact_phone",
    "purchase_price",
    "purchase_date",
]


def load_csv(path: str) -> pd.DataFrame:
    return pd.read_csv(path)


def map_manitoba_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Rename Manitoba Roll Entry columns when present."""
    rename = {k: v for k, v in MB_COLUMN_MAP.items() if k in df.columns}
    out = df.rename(columns=rename)
    missing = [c for c in ("address", "city", "postal_code") if c not in out.columns]
    if missing:
        raise SystemExit(
            f"Missing required columns after mapping: {missing}. "
            f"Expected Manitoba columns {list(MB_COLUMN_MAP.keys())} or "
            f"already-mapped names address, city, postal_code."
        )
    return out


def normalize(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["city"] = df["city"].str.lower().str.strip()
    df["postal_code"] = (
        df["postal_code"]
        .fillna("")
        .astype(str)
        .str.replace(" ", "", regex=False)
        .str.replace("-", "", regex=False)
        .str.upper()
    )
    return df


def filter_r3y(df: pd.DataFrame) -> pd.DataFrame:
    return df[
        df["city"].str.contains("winnipeg", na=False)
        & df["postal_code"].str.startswith("R3Y")
    ]


def export_candidates(df: pd.DataFrame) -> None:
    sample = df.head(20)
    for col in ("contact_phone", "purchase_price", "purchase_date"):
        if col not in sample.columns:
            sample = sample.copy()
            sample[col] = ""
    sample.to_csv("/tmp/mb_candidates.csv", index=False)
    print("Wrote /tmp/mb_candidates.csv")


def make_external_id(row: pd.Series) -> str:
    key = f"{row['address']}_{row['postal_code']}"
    return hashlib.sha256(key.encode()).hexdigest()


def parse_purchase_price(value: object) -> float:
    if pd.isna(value):
        raise ValueError("purchase_price is empty")
    if isinstance(value, (int, float)):
        return float(value)
    s = str(value).strip().replace(",", "").replace("$", "")
    if not s:
        raise ValueError("purchase_price is empty")
    return float(s)


def validate_enriched_row(row: pd.Series, row_index: int) -> None:
    for col in ENRICHED_COLUMNS:
        if col not in row.index:
            raise ValueError(f"row {row_index}: missing column {col!r}")
        val = row[col]
        if pd.isna(val):
            raise ValueError(f"row {row_index}: required field {col!r} is null/NaN")
        if col == "purchase_price":
            if str(val).strip() == "":
                raise ValueError(
                    f"row {row_index}: required field {col!r} is empty"
                )
        elif str(val).strip() == "":
            raise ValueError(f"row {row_index}: required field {col!r} is empty")


def send_row(row: pd.Series, api_url: str, row_index: int) -> None:
    validate_enriched_row(row, row_index)
    price = parse_purchase_price(row["purchase_price"])

    payload = {
        "source": "mb_roll_entry_v1",
        "external_id": make_external_id(row),
        "payload": {
            "address": str(row["address"]).strip(),
            "city": str(row["city"]).strip(),
            "postal_code": str(row["postal_code"]).strip(),
            "contact_phone": str(row["contact_phone"]).strip(),
            "purchase_price": price,
            "purchase_date": str(row["purchase_date"]).strip(),
        },
    }

    r = requests.post(api_url, json=payload, timeout=60)

    if r.status_code == 200:
        print(f"row {row_index}: ok {r.text}")
        return

    if r.status_code == 409:
        print(f"row {row_index}: duplicate external_id — {r.text}")
        return

    print(f"row {row_index}: Failed ({r.status_code}): {r.text}")
    sys.exit(1)


def run_candidates(input_path: str) -> None:
    df = load_csv(input_path)
    df = map_manitoba_columns(df)
    df = normalize(df)
    df = filter_r3y(df)
    if df.empty:
        print(
            "No rows matched Winnipeg + R3Y after filter. "
            "Check input path and column names.",
            file=sys.stderr,
        )
        sys.exit(1)
    export_candidates(df)


def run_send(input_path: str) -> None:
    api_url = os.getenv("LEADFLOW_API_URL")
    if not api_url or not str(api_url).strip():
        print(
            "LEADFLOW_API_URL is not set. Add it to .env, e.g.\n"
            "  LEADFLOW_API_URL=http://localhost:3000/api/ingest",
            file=sys.stderr,
        )
        sys.exit(1)
    api_url = str(api_url).strip()

    df = load_csv(input_path)
    missing_cols = [c for c in ENRICHED_COLUMNS if c not in df.columns]
    if missing_cols:
        print(
            f"Enriched CSV missing columns: {missing_cols}. Need: {ENRICHED_COLUMNS}",
            file=sys.stderr,
        )
        sys.exit(1)

    for i, row in df.iterrows():
        try:
            send_row(row, api_url, int(i) if isinstance(i, int) else i)
        except ValueError as e:
            print(str(e), file=sys.stderr)
            sys.exit(1)


def main() -> None:
    repo_root = Path(__file__).resolve().parent.parent.parent
    load_dotenv(repo_root / ".env")
    load_dotenv(repo_root / ".env.local", override=False)

    parser = argparse.ArgumentParser(
        description="Manitoba Roll Entry → LeadFlow ingest (candidates or --send)."
    )
    parser.add_argument("--input", required=True, help="Path to CSV file")
    parser.add_argument(
        "--send",
        action="store_true",
        help="POST enriched rows to LEADFLOW_API_URL (default: candidate export only)",
    )
    args = parser.parse_args()

    if args.send:
        run_send(args.input)
    else:
        run_candidates(args.input)


if __name__ == "__main__":
    main()
