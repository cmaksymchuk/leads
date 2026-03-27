import { DashboardFilters } from "@/components/leads/dashboard-filters";
import { LeadDetailPanel } from "@/components/leads/lead-detail-panel";
import { LeadsTable } from "@/components/leads/leads-table";
import { loadLeadDetail, loadLeads } from "@/lib/dashboard/load-leads";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "LeadFlow Canada — Dashboard",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const status = typeof sp.status === "string" ? sp.status : undefined;
  const min_score_raw = sp.min_score;
  const min_score =
    typeof min_score_raw === "string" && min_score_raw.length > 0
      ? Number(min_score_raw)
      : undefined;

  const detailId = typeof sp.detail === "string" ? sp.detail : undefined;

  const leads = await loadLeads({
    status,
    min_score:
      min_score !== undefined && !Number.isNaN(min_score)
        ? min_score
        : undefined,
  });

  const detail = detailId ? await loadLeadDetail(detailId) : null;
  if (detailId && !detail) notFound();

  return (
    <div className="bg-background text-foreground mx-auto flex min-h-full max-w-6xl flex-col gap-8 px-4 py-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          LeadFlow Canada
        </h1>
        <p className="text-muted-foreground text-sm">
          Callable renewal leads — address, shock, score, phone.
        </p>
      </header>

      <Suspense fallback={<p className="text-muted-foreground text-sm">Filters…</p>}>
        <DashboardFilters />
      </Suspense>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <LeadsTable leads={leads} />
        {detail && <LeadDetailPanel detail={detail} />}
      </div>
    </div>
  );
}
