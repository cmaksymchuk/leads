# ADR-0001: Pipeline shape — raw_records → leads

Date: 2025-03-27
Status: Accepted

## Context
Leads arrive from external sources in formats we don't control.
We need to separate "receiving data" from "qualifying data" cleanly.

## Decision
All ingest writes to raw_records only. Processing is a separate step
that promotes to leads when qualification rules pass. These are
never combined into a single operation.

## Consequences
- Ingest is always fast and never blocks on business logic.
- Every raw record is auditable regardless of outcome.
- Processing can be retried without re-ingesting.
- Skip reasons must be stored on the raw_record, not inferred later.
