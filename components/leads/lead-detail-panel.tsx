import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { LeadDetailBundle } from "@/lib/dashboard/load-leads";
import Link from "next/link";

export function LeadDetailPanel({ detail }: { detail: LeadDetailBundle }) {
  const { lead, events, scores } = detail;

  return (
    <Card className="border-border">
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-lg">
            {(lead.company_name as string) ?? "Lead"}
          </CardTitle>
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
          <Badge>{String(lead.lead_type)}</Badge>
          <Badge variant="outline">{String(lead.status)}</Badge>
        </div>
        <div>
          <h4 className="mb-2 text-sm font-medium">Metadata</h4>
          <ScrollArea className="h-40 rounded-md border p-3">
            <pre className="text-xs whitespace-pre-wrap break-words">
              {JSON.stringify(lead.metadata ?? {}, null, 2)}
            </pre>
          </ScrollArea>
        </div>
        <div>
          <h4 className="mb-2 text-sm font-medium">Events</h4>
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
        </div>
        <Separator />
        <div>
          <h4 className="mb-2 text-sm font-medium">Score breakdown</h4>
          <ul className="space-y-2 text-sm">
            {scores.length === 0 ? (
              <li className="text-muted-foreground">No scores</li>
            ) : (
              scores.map((s) => (
                <li key={s.id} className="rounded-md border p-2">
                  <div className="flex justify-between gap-2">
                    <span className="font-semibold">Score: {Number(s.score)}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(s.created_at).toLocaleString()}
                    </span>
                  </div>
                  <pre className="mt-1 max-h-32 overflow-auto text-xs">
                    {JSON.stringify(s.reasoning, null, 2)}
                  </pre>
                </li>
              ))
            )}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
