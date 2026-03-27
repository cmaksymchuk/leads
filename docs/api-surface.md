# API Surface

| Method | Route | Flow | Auth | Purpose |
|---|---|---|---|---|
| POST | /api/ingest | lead-capture | None (validate source) | Accept raw lead payload |
| POST | /api/process-raw | processing | HMAC | Claim and process raw_records |
| POST | /api/preview-outreach | preview | None | Dry-run outreach text for a lead |
