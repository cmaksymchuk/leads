import Link from "next/link";

export default function Home() {
  return (
    <div className="bg-background flex min-h-full flex-col items-center justify-center px-6 py-24">
      <div className="max-w-lg space-y-6 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">
          LeadFlow Canada
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Ingest property records with phone numbers, fingerprint addresses, and
          surface high-intent mortgage renewal leads — processing stays on the
          server.
        </p>
        <Link
          href="/dashboard"
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 items-center justify-center rounded-lg px-4 text-sm font-medium transition-colors"
        >
          Open dashboard
        </Link>
      </div>
    </div>
  );
}
