# Manitoba Roll Entry ingest

Thin client for LeadFlow: it maps a Manitoba Roll Entry CSV, filters to a small geographic slice, writes a candidate file for **manual** enrichment, then POSTs enriched rows to the app’s **`/api/ingest`** endpoint. Scoring, dedupe, and processing stay in the Next.js + Supabase pipeline.

## Setup

From this directory:

```bash
cd python/mb_roll_entry
python3 -m venv .venv
source .venv/bin/activate    # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

Dependencies: `pandas`, `requests`, `python-dotenv` only.

## Environment

The script loads `.env` and then `.env.local` from the **repository root** (two levels up from `mb_roll_entry/`).

Set:

```bash
LEADFLOW_API_URL=http://localhost:3000/api/ingest
```

Use your deployed origin in production (same path: `/api/ingest`).

## Usage

### 1. Generate candidates (default)

Point `--input` at a Manitoba Roll Entry CSV. The script maps columns, normalizes postal codes, keeps **Winnipeg** rows whose postal code starts with **R3Y**, and writes up to **20** rows to:

**`/tmp/mb_candidates.csv`**

```bash
python ingest_mb_roll_entry.py --input /path/to/roll.csv
```

Fill in **`contact_phone`**, **`purchase_price`**, and **`purchase_date`** in that file (or save a copy elsewhere). This dataset does not reliably include purchase dates; do not treat assessment roll year as purchase date.

### 2. Send enriched rows

The enriched CSV must include these columns (exact names):

| Column           | Notes                                      |
|------------------|--------------------------------------------|
| `address`        | Street address                             |
| `city`           | City                                       |
| `postal_code`    | Normalized on send (spacing stripped)      |
| `contact_phone`  | Required                                   |
| `purchase_price` | Number; `$` and commas are stripped        |
| `purchase_date`  | Non-empty string (e.g. ISO date)           |

```bash
python ingest_mb_roll_entry.py --input /path/to/enriched.csv --send
```

Missing or empty required fields cause a **non-zero exit** with an error message. HTTP **409** (duplicate `external_id`) is logged and the script continues; other non-success responses exit with **1**.

## Source column mapping (candidate mode)

From Manitoba Open Data roll entry fields:

- `PROPERTY_ADDRESS` → `address`
- `MUNI_NAME_WITH_TYP` → `city`
- `POSTAL_CODE` → `postal_code`

If your file already uses `address`, `city`, and `postal_code`, mapping is optional.

## Payload to the API

Each row is sent as JSON:

- `source`: `mb_roll_entry_v1`
- `external_id`: SHA-256 of `"{address}_{postal_code}"`
- `payload`: matches the app’s ingest schema (`address`, `city`, `postal_code`, `contact_phone`, `purchase_price`, `purchase_date`)

After ingest, run your usual **`/api/process-raw`** (or batch job) so `raw_records` become leads.

## Troubleshooting

- **`LEADFLOW_API_URL is not set`**: define it in repo-root `.env` or `.env.local`.
- **`python-dotenv could not parse …`**: fix the reported line in `.env` / `.env.local` (syntax issue), not in this script.
- **No rows after filter**: confirm Winnipeg + R3Y data and column names in the source CSV.
