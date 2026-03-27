# Documentation Update Prompt

Review the changes in this PR and update only the documentation that is
affected. Do not rewrite sections that are still accurate.

## Rules
- New migration added → update schema section of docs/STATE.md
- New env var in code → add to docs/env-vars.md and .env.example
- New API route added → add one line to docs/api-surface.md
- Non-obvious architectural decision → create docs/adr/NNNN-title.md
- Do not update docs that are unaffected by these changes
- Do not add padding, intros, or summaries that weren't there before

## ADR format (if needed)
# ADR-NNNN: Title
Date: YYYY-MM-DD
Status: Accepted

## Context
Why this decision was needed.

## Decision
What was decided.

## Consequences
What this means going forward. What it rules out.
