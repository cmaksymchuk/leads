# Git activity report (`scripts/git-activity-report.mjs`)

Exports **commit metadata** and **`git log --numstat`** line counts into CSV for timesheet support, activity review, or SR&ED corroboration. This is **not** a payroll clock: it measures **what landed in git**, not focused wall-clock time.

## Quick start

From the repo root:

```bash
npm run timesheet:git -- --since 2026-01-01 --daily reports/git-activity/daily.csv --commits reports/git-activity/commits.csv
```

Or directly:

```bash
node scripts/git-activity-report.mjs --since 2026-01-01 --daily reports/git-activity/daily.csv --commits reports/git-activity/commits.csv
```

`--help` / `-h` prints all flags.

## Outputs

### Daily CSV (`--daily`)

One row per **calendar day** (in `--tz`) per **author email**:

| Column | Meaning |
|--------|---------|
| `date_local` | `YYYY-MM-DD` in `--tz` |
| `timezone` | IANA zone used |
| `author_email`, `author_name` | From commit author |
| `commit_count` | Commits that day |
| `unique_files_touched` | Distinct paths after exclusions |
| `insertions`, `deletions`, `net_lines` | Sum of numstat (after exclusions) |
| `first_commit_utc`, `last_commit_utc` | Author timestamps |
| `span_hours_commit_timestamps` | `(last - first) / 3600` — **not** hours worked |
| `commit_shas` | Space-separated SHAs |

### Per-commit CSV (`--commits`)

One row per commit:

| Column | Meaning |
|--------|---------|
| `commit_sha` | Full hash |
| `author_*`, `committer_*` | Name/email |
| `author_date_utc`, `committer_date_utc` | ISO UTC |
| `date_local_author` | Author date mapped to local calendar day in `--tz` |
| `subject` | First line of subject (see limitations) |
| `insertions`, `deletions`, `net_lines`, `files_changed` | After exclusions |
| `paths` | `; `-separated paths |

## Filters

- **`--since` / `--until`** — Passed to `git log` (same rules as Git; date-only strings are interpreted per Git).
- **`--author <pattern>`** — `git --author=` (matches author name or email).
- **`--rev <range>`** — Default `HEAD`. Examples: `main..HEAD` (commits on branch not in `main`), `HEAD~10..HEAD`.
- **`--path <path>`** — Repeatable pathspec; only those paths count in numstat for matched commits.
- **`--include-merges`** — By default **merge commits are excluded** (`--no-merges`).
- **`--first-parent`** — Linear history along first parent (useful on noisy merge graphs).

## Excluding noisy paths

Repeat **`--exclude <glob>`** to drop numstat lines before totals. Globs support `*` and `?`; `*` does not cross `/`.

Examples:

```bash
node scripts/git-activity-report.mjs \
  --since 2026-01-01 \
  --exclude "package-lock.json" \
  --exclude "*.png" \
  --daily reports/git-activity/daily.csv \
  --commits reports/git-activity/commits.csv
```

## Timezone

**`--tz America/Winnipeg`** (or any IANA name) controls `date_local` / `date_local_author`. Default: system timezone from Node.

## Re-runnable? Incremental log?

**Yes, re-runnable; no append-only ledger inside the tool.**

- Each run runs **`git log` from scratch** for the given `--rev`, `--since`, `--until`, filters, and pathspecs.
- Output files are **written fresh** (directories are created; existing files are **overwritten**).
- **Same repo state + same arguments ⇒ same CSV.** Re-running does **not** duplicate rows inside one file.
- The tool **does not** read old CSVs or track “already exported” SHAs. If **you** merge two overlapping CSV exports manually, you could double-count — prefer **one** export per reporting window, or non-overlapping `--since`/`--until` slices.

After **rebase / amend / squash**, history changes; the next export reflects **new** SHAs and dates.

## Limitations

- **Subject lines with embedded newlines** can break the lightweight parser; keep subjects single-line when possible.
- **Binary files** appear as `-` `-` in numstat and are skipped.
- **Lines changed ≠ time spent** (refactors, generated code, AI bulk, etc.).
- **`span_hours_commit_timestamps`** is only the spread between first and last **author** timestamp that day — not duration at keyboard.

## npm script

`package.json` includes:

```json
"timesheet:git": "node scripts/git-activity-report.mjs"
```

Pass flags after `--`:

```bash
npm run timesheet:git -- --help
```

## Ignoring generated reports

This repo **gitignores** `/reports/git-activity/` so routine exports stay local. Remove that line from `.gitignore` if you want to commit snapshots for a given period.
