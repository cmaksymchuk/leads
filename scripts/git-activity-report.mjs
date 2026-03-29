#!/usr/bin/env node
/**
 * Git activity report: aggregates commit metadata and numstat into CSV.
 * See docs/git-activity-report.md
 */

import { spawnSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const MARKER = "---GIT_ACTIVITY_COMMIT---";

function usage() {
  return `git-activity-report — export commit activity from git to CSV

USAGE
  node scripts/git-activity-report.mjs [options]

OUTPUT (at least one required)
  --daily <file>     Daily aggregate CSV (local date in --tz)
  --commits <file>   Per-commit detail CSV

FILTERS
  --since <date>     Git --since (omit for full history on --rev)
  --until <date>     Git --until
  --author <pattern> Passed to git --author= (matches name or email)
  --rev <range>      Revision set (default: HEAD). Examples: HEAD, main..HEAD
  --path <path>      Repeatable. Limit to pathspecs (after -- on git log)
  --include-merges   Include merge commits (default: exclude)
  --first-parent     git log --first-parent

EXCLUSIONS (numstat lines removed; totals recomputed)
  --exclude <glob>   Repeatable. Glob with * and ? (* does not cross /)

TIMEZONE
  --tz <iana>        IANA zone for date_local columns (default: system)

OTHER
  --help, -h         This help

Re-runs: stateless. Each run reads git only; output files are overwritten.
`;
}

function die(msg, code = 1) {
  console.error(msg);
  process.exit(code);
}

function git(cwd, args) {
  const r = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.error) die(String(r.error));
  if (r.status !== 0) {
    die(r.stderr.trim() || `git ${args.join(" ")} failed (${r.status})`);
  }
  return { stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

/** Glob * and ? only; * does not cross / */
function matchGlob(pattern, str) {
  const esc = pattern.replace(/[[.+^${}()|\\]/g, "\\$&");
  const re = new RegExp(
    "^" +
      esc
        .replaceAll("**", "\0DOUBLESTAR\0")
        .replaceAll("*", "[^/]*")
        .replaceAll("?", "[^/]")
        .replaceAll("\0DOUBLESTAR\0", ".*") +
      "$",
  );
  return re.test(str);
}

function csvEscape(value) {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

function rowToCsv(cells) {
  return cells.map(csvEscape).join(",");
}

function toLocalDateKey(unixSec, timeZone) {
  const d = new Date(Number(unixSec) * 1000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${day}`;
}

function toIsoUtc(unixSec) {
  return new Date(Number(unixSec) * 1000).toISOString();
}

function parseLog(stdout, excludeGlobs) {
  /** @type {Array<{hash: string, ae: string, an: string, ce: string, cn: string, at: string, ct: string, subject: string, files: Array<{add: number, del: number, path: string}>}>} */
  const commits = [];
  const blocks = stdout.split(MARKER + "\n").filter((b) => b.trim().length > 0);

  for (const block of blocks) {
    const lines = block.split("\n");
    const hash = lines[0]?.trim();
    const ae = lines[1]?.trim() ?? "";
    const an = lines[2]?.trim() ?? "";
    const ce = lines[3]?.trim() ?? "";
    const cn = lines[4]?.trim() ?? "";
    const at = lines[5]?.trim() ?? "";
    const ct = lines[6]?.trim() ?? "";
    const subject = lines[7] ?? "";
    const numstatLines = lines.slice(8).filter((l) => l.trim().length > 0);

    const files = [];
    for (const line of numstatLines) {
      const tab = line.indexOf("\t");
      if (tab === -1) continue;
      const a = line.slice(0, tab);
      const rest = line.slice(tab + 1);
      const tab2 = rest.indexOf("\t");
      if (tab2 === -1) continue;
      const b = rest.slice(0, tab2);
      const path = rest.slice(tab2 + 1);
      if (a === "-" && b === "-") continue; // binary
      const add = parseInt(a, 10) || 0;
      const del = parseInt(b, 10) || 0;
      if (excludeGlobs.some((g) => matchGlob(g, path))) continue;
      files.push({ add, del, path });
    }

    if (!hash) continue;
    commits.push({ hash, ae, an, ce, cn, at, ct, subject, files });
  }

  return commits;
}

function aggregateDaily(commits, timeZone) {
  /** @type {Map<string, {date: string, ae: string, an: string, commits: typeof commits, paths: Set<string>, firstAt: number, lastAt: number, ins: number, dels: number}>} */
  const map = new Map();

  for (const c of commits) {
    const date = toLocalDateKey(c.at, timeZone);
    const key = `${date}\t${c.ae}`;
    let row = map.get(key);
    if (!row) {
      row = {
        date,
        ae: c.ae,
        an: c.an,
        commits: [],
        paths: new Set(),
        firstAt: Number(c.at),
        lastAt: Number(c.at),
        ins: 0,
        dels: 0,
      };
      map.set(key, row);
    }
    row.commits.push(c);
    row.firstAt = Math.min(row.firstAt, Number(c.at));
    row.lastAt = Math.max(row.lastAt, Number(c.at));
    for (const f of c.files) {
      row.paths.add(f.path);
      row.ins += f.add;
      row.dels += f.del;
    }
  }

  return [...map.values()].sort((a, b) =>
    a.date !== b.date ? a.date.localeCompare(b.date) : a.ae.localeCompare(b.ae),
  );
}

function main() {
  const { values, positionals } = parseArgs({
    options: {
      daily: { type: "string" },
      commits: { type: "string" },
      since: { type: "string" },
      until: { type: "string" },
      author: { type: "string" },
      rev: { type: "string", default: "HEAD" },
      path: { type: "string", multiple: true },
      "include-merges": { type: "boolean", default: false },
      "first-parent": { type: "boolean", default: false },
      exclude: { type: "string", multiple: true },
      tz: { type: "string" },
      help: { type: "boolean", short: "h", default: false },
    },
    allowPositionals: true,
    strict: true,
  });

  if (values.help) {
    console.log(usage());
    process.exit(0);
  }

  if (!values.daily && !values.commits) {
    console.error("Error: specify --daily <file> and/or --commits <file>\n");
    console.log(usage());
    process.exit(1);
  }

  const cwd = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  git(cwd, ["rev-parse", "--git-dir"]);

  const timeZone =
    values.tz ||
    Intl.DateTimeFormat().resolvedOptions().timeZone ||
    "UTC";

  const excludeGlobs = values.exclude ?? [];
  const pathspecs = [...(values.path ?? []), ...positionals];

  const logArgs = [
    "log",
    values.rev,
    "--reverse",
    `--pretty=format:${MARKER}%n%H%n%ae%n%an%n%ce%n%cn%n%at%n%ct%n%s`,
    "--numstat",
  ];
  if (!values["include-merges"]) logArgs.push("--no-merges");
  if (values["first-parent"]) logArgs.push("--first-parent");
  if (values.since) logArgs.push(`--since=${values.since}`);
  if (values.until) logArgs.push(`--until=${values.until}`);
  if (values.author) logArgs.push(`--author=${values.author}`);
  logArgs.push("--", ...pathspecs);

  const { stdout } = git(cwd, logArgs);
  const parsed = parseLog(stdout, excludeGlobs);

  const dailyHeaders = [
    "date_local",
    "timezone",
    "author_email",
    "author_name",
    "commit_count",
    "unique_files_touched",
    "insertions",
    "deletions",
    "net_lines",
    "first_commit_utc",
    "last_commit_utc",
    "span_hours_commit_timestamps",
    "commit_shas",
  ];

  const dailyRows = aggregateDaily(parsed, timeZone).map((d) => {
    const spanH = (d.lastAt - d.firstAt) / 3600;
    const net = d.ins - d.dels;
    const shas = d.commits.map((c) => c.hash).join(" ");
    return rowToCsv([
      d.date,
      timeZone,
      d.ae,
      d.an,
      d.commits.length,
      d.paths.size,
      d.ins,
      d.dels,
      net,
      toIsoUtc(d.firstAt),
      toIsoUtc(d.lastAt),
      spanH.toFixed(4),
      shas,
    ]);
  });

  const commitHeaders = [
    "commit_sha",
    "author_email",
    "author_name",
    "committer_email",
    "committer_name",
    "author_date_utc",
    "committer_date_utc",
    "date_local_author",
    "timezone",
    "subject",
    "insertions",
    "deletions",
    "net_lines",
    "files_changed",
    "paths",
  ];

  const commitRows = parsed.map((c) => {
    const ins = c.files.reduce((s, f) => s + f.add, 0);
    const dels = c.files.reduce((s, f) => s + f.del, 0);
    const paths = c.files.map((f) => f.path).join("; ");
    return rowToCsv([
      c.hash,
      c.ae,
      c.an,
      c.ce,
      c.cn,
      toIsoUtc(c.at),
      toIsoUtc(c.ct),
      toLocalDateKey(c.at, timeZone),
      timeZone,
      c.subject,
      ins,
      dels,
      ins - dels,
      c.files.length,
      paths,
    ]);
  });

  function writeOut(relPath, headerRow, rows) {
    const body = [headerRow, ...rows].join("\n") + "\n";
    const abs = resolve(cwd, relPath);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, body, "utf8");
    console.error(`Wrote ${rows.length} rows → ${abs}`);
  }

  if (values.daily) {
    writeOut(values.daily, rowToCsv(dailyHeaders), dailyRows);
  }
  if (values.commits) {
    writeOut(values.commits, rowToCsv(commitHeaders), commitRows);
  }

  console.error(
    JSON.stringify({
      tool: "git-activity-report",
      rev: values.rev,
      commits: parsed.length,
      timezone: timeZone,
      excludeGlobs,
    }),
  );
}

main();
