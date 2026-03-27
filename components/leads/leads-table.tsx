import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { LeadListRow } from "@/lib/dashboard/load-leads";
import Link from "next/link";

export function LeadsTable({ leads }: { leads: LeadListRow[] }) {
  if (leads.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No leads yet. Ingest via{" "}
        <code className="rounded bg-muted px-1 py-0.5">POST /api/ingest</code>{" "}
        with <code className="rounded bg-muted px-1 py-0.5">generic_json</code>.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Company</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Region</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Score</TableHead>
          <TableHead>Signal (metadata)</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {leads.map((l) => (
          <TableRow key={l.id}>
            <TableCell className="font-medium">{l.company_name}</TableCell>
            <TableCell>
              <Badge variant="secondary">{l.lead_type}</Badge>
            </TableCell>
            <TableCell>{l.region}</TableCell>
            <TableCell>{l.status}</TableCell>
            <TableCell>
              {l.latest_score !== null ? l.latest_score : "—"}
            </TableCell>
            <TableCell className="max-w-[220px] truncate font-mono text-xs text-muted-foreground">
              {signalPreview(l)}
            </TableCell>
            <TableCell>
              <Link
                className="text-primary text-sm underline"
                href={`/dashboard?detail=${l.id}`}
                scroll={false}
              >
                Detail
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function signalPreview(row: LeadListRow): string {
  const m = row.metadata;
  if (!m || typeof m !== "object") return "";
  const st = m.signal_type;
  if (typeof st === "string") return `signal_type: ${st}`;
  return JSON.stringify(m).slice(0, 80);
}
