#!/usr/bin/env python3
"""
Thin feeder for LeadFlow: Manitoba Roll Entry CSV → candidates or POST /api/ingest.

Business logic stays in the Next.js app; this script only maps, filters, and sends HTTP.

Column matching is case-insensitive. Original CSV files are never modified — point --input at the file as downloaded.
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

# Aliases tried in order (case-insensitive match against CSV headers).
ADDRESS_ALIASES = ("PROPERTY_ADDRESS", "Property_Address", "property_address")
CITY_ALIASES = ("MUNI_NAME_WITH_TYP", "Muni_Name_With_Typ", "municipality")
POSTAL_ALIASES = ("POSTAL_CODE", "Postal_Code", "PostalCode", "postal_code")

ENRICHED_COLUMNS = [
    "address",
    "city",
    "postal_code",
    "contact_phone",
    "purchase_price",
    "purchase_date",
]


def load_csv(path: str) -> pd.DataFrame:
    # utf-8-sig strips BOM so the first column is not \ufeffOBJECTID
    return pd.read_csv(path, encoding="utf-8-sig", low_memory=False)


def _strip_bom(name: str) -> str:
    return name.replace("\ufeff", "").strip()


def _column_index(df: pd.DataFrame) -> dict[str, str]:
    """Lowercase header -> actual column name in frame."""
    return {_strip_bom(c).lower(): c for c in df.columns}


def _pick_column(df: pd.DataFrame, aliases: tuple[str, ...]) -> str | None:
    """Resolve first alias that exists (case-insensitive, BOM-tolerant)."""
    idx = _column_index(df)
    for a in aliases:
        key = _strip_bom(a).lower()
        if key in idx:
            return idx[key]
    return None


def map_manitoba_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Rename roll-entry columns to address, city, postal_code. Never mutates the file on disk."""
    addr_col = _pick_column(df, ADDRESS_ALIASES)
    city_col = _pick_column(df, CITY_ALIASES)
    postal_col = _pick_column(df, POSTAL_ALIASES)

    if not addr_col or not city_col:
        have = list(df.columns)
        raise SystemExit(
            "Missing required columns after header lookup.\n"
            f"  address column found: {addr_col!r} (need one of {ADDRESS_ALIASES})\n"
            f"  city column found: {city_col!r} (need one of {CITY_ALIASES})\n"
            f"  Columns in file ({len(have)}): {have[:20]}{'...' if len(have) > 20 else ''}"
        )

    out = df.rename(columns={addr_col: "address", city_col: "city"})
    if postal_col:
        out = out.rename(columns={postal_col: "postal_code"})
    else:
        out = out.copy()
        out["postal_code"] = ""

    return out


def normalize(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["city"] = df["city"].fillna("").astype(str).str.lower().str.strip()
    df["postal_code"] = (
        df["postal_code"]
        .fillna("")
        .astype(str)
        .str.replace(" ", "", regex=False)
        .str.replace("-", "", regex=False)
        .str.upper()
    )
    return df


def _brandon_city_mask(df: pd.DataFrame) -> pd.Series:
    """City of Brandon (MB roll: Muni_Name_With_Typ / Municipality)."""
    c = df["city"].fillna("").astype(str).str.lower()
    primary = c.str.contains(r"brandon\s*\(city\)", na=False, regex=True)
    if "Municipality" in df.columns:
        m = df["Municipality"].fillna("").astype(str).str.lower()
        primary = primary | m.str.contains("city of brandon", na=False)
    return primary


def _brandon_postal_mask(pc: pd.Series) -> pd.Series:
    """Brandon area FSAs R7A / R7B / R7C (normalized: no spaces, uppercase)."""
    s = pc.fillna("").astype(str).str.strip()
    return s.str.match(r"^R7[ABC]", na=False)


def filter_candidates(df: pd.DataFrame) -> pd.DataFrame:
    """City of Brandon rows; R7A/R7B/R7C postal prefix when the file has postal codes."""
    brandon = _brandon_city_mask(df)
    pc = df["postal_code"].fillna("").astype(str).str.strip()
    postal_present = pc.str.len() > 0

    if not postal_present.any():
        print(
            "Note: no postal codes in this file; using City of Brandon muni filter only "
            "(add R7A–R7C postal codes during enrichment).",
            file=sys.stderr,
        )
        return df[brandon]

    return df[brandon & _brandon_postal_mask(pc)]


def export_candidates(df: pd.DataFrame) -> None:
    sample = df.head(20)
    base = sample[["address", "city", "postal_code"]].copy()
    for col in ("contact_phone", "purchase_price", "purchase_date"):
        base[col] = ""
    base.to_csv("/tmp/mb_candidates.csv", index=False)
    print("Wrote /tmp/mb_candidates.csv")


def make_external_id(row: pd.Series) -> str:
    addr = str(row["address"]).strip()
    pc = str(row.get("postal_code", "")).strip()
    parts = [addr, pc]
    if not pc and "Roll_No" in row.index and pd.notna(row["Roll_No"]):
        parts.append(str(row["Roll_No"]).strip())
    key = "|".join(parts)
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
    df = filter_candidates(df)
    if df.empty:
        print(
            "No rows matched: City of Brandon (muni `brandon (city)` or Municipality "
            "`city of brandon`), plus R7A/R7B/R7C postal prefix when the file has postal codes.\n"
            "Your CSV is unchanged — verify the roll file includes Brandon city rows and column names.",
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
