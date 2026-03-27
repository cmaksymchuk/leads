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
import { MarkSoldButton } from "./mark-sold-button";

function formatMoney(n: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(n);
}

function detailHref(leadId: string, queryPreserved: string): string {
  const p = new URLSearchParams(queryPreserved);
  p.set("detail", leadId);
  return `/dashboard?${p.toString()}`;
}

export function LeadsTable({
  leads,
  queryPreserved = "",
}: {
  leads: LeadListRow[];
  queryPreserved?: string;
}) {
  if (leads.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No leads yet. Ingest via{" "}
        <code className="rounded bg-muted px-1 py-0.5">POST /api/ingest</code>{" "}
        with a Canada mortgage payload, then run{" "}
        <code className="rounded bg-muted px-1 py-0.5">POST /api/process-raw</code>{" "}
        (HMAC).
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Address</TableHead>
          <TableHead>City</TableHead>
          <TableHead>Province</TableHead>
          <TableHead>Payment shock</TableHead>
          <TableHead>Months to renewal</TableHead>
          <TableHead>Score</TableHead>
          <TableHead>Phone</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {leads.map((l) => (
          <TableRow key={l.id}>
            <TableCell className="max-w-[200px] font-medium">
              {l.address}
            </TableCell>
            <TableCell>{l.city}</TableCell>
            <TableCell className="font-mono text-xs">{l.region}</TableCell>
            <TableCell>{formatMoney(Number(l.payment_shock))}</TableCell>
            <TableCell>{l.months_to_renewal}</TableCell>
            <TableCell>{l.score}</TableCell>
            <TableCell className="font-mono text-xs">{l.contact_phone}</TableCell>
            <TableCell>
              <Badge variant="secondary">{l.status}</Badge>
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-2">
                {l.status === "available" ? (
                  <MarkSoldButton leadId={l.id} />
                ) : null}
                <Link
                  className="text-primary inline-flex items-center text-sm underline"
                  href={detailHref(l.id, queryPreserved)}
                  scroll={false}
                >
                  Detail
                </Link>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
