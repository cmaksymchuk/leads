# Python ingest feeders

Each subdirectory is a **standalone** ingest script with its own `requirements.txt` and README. Install dependencies per ingestor (separate venvs avoid version conflicts between tools).

| Ingestor | Description |
|----------|-------------|
| [`mb_roll_entry/`](./mb_roll_entry/) | Manitoba Roll Entry CSV → candidate addresses → POST `/api/ingest` |

Shared convention:

- **Env:** set `LEADFLOW_API_URL` in the repo-root `.env` or `.env.local` (e.g. `http://localhost:3000/api/ingest`).
- **Scope:** mapping, filtering, and HTTP only — business logic stays in the Next.js app.

Adding a new ingestor: create `python/<name>/` with `requirements.txt`, `README.md`, and the script; link it in the table above.
