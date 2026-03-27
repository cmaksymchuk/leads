import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { LeadDetailBundle } from "@/lib/dashboard/load-leads";
import Link from "next/link";

export function LeadDetailPanel({ detail }: { detail: LeadDetailBundle }) {
  const { lead, events } = detail;

  const title =
    typeof lead.address === "string" && lead.address.length > 0
      ? lead.address
      : "Lead";

  return (
    <Card className="border-border">
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-lg">{title}</CardTitle>
          <CardDescription className="font-mono text-xs">
            {lead.id as string}
          </CardDescription>
        </div>
        <Link
          href="/dashboard"
          className="text-muted-foreground text-sm hover:underline"
        >
          Close
        </Link>
      </CardHeader>
      <CardContent className="grid gap-6">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{String(lead.status)}</Badge>
          <Badge>score {String(lead.score)}</Badge>
        </div>
        <dl className="grid gap-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Province</dt>
            <dd className="font-mono">{String(lead.region ?? "")}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">City</dt>
            <dd>{String(lead.city ?? "")}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Postal</dt>
            <dd className="font-mono">{String(lead.postal_code ?? "")}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Phone</dt>
            <dd className="font-mono">{String(lead.contact_phone ?? "")}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Payment shock</dt>
            <dd>{String(lead.payment_shock ?? "")}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Months to renewal</dt>
            <dd>{String(lead.months_to_renewal ?? "")}</dd>
          </div>
        </dl>
        <div>
          <h4 className="mb-2 text-sm font-medium">Events</h4>
          <ScrollArea className="h-48 rounded-md border p-3">
            <ul className="space-y-2 text-sm">
              {events.length === 0 ? (
                <li className="text-muted-foreground">No events</li>
              ) : (
                events.map((e) => (
                  <li key={e.id} className="rounded-md border p-2">
                    <div className="flex justify-between gap-2 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {e.event_type}
                      </span>
                      <span>{new Date(e.created_at).toLocaleString()}</span>
                    </div>
                    <pre className="mt-1 max-h-24 overflow-auto text-xs">
                      {JSON.stringify(e.payload, null, 2)}
                    </pre>
                  </li>
                ))
              )}
            </ul>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}
