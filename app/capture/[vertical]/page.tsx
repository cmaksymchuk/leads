import { CaptureExperience } from "@/components/capture/CaptureExperience";
import { getCaptureChatModeFromEnv } from "@/lib/capture/chat-mode";
import { getVerticalConfig } from "@/lib/capture/verticals";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

type PageProps = {
  params: Promise<{ vertical: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { vertical } = await params;
  const config = getVerticalConfig(vertical);
  if (!config) {
    return { title: "Capture" };
  }
  return { title: config.title };
}

function ChatFallback() {
  return (
    <div
      className="border-border bg-card rounded-xl border p-6"
      aria-busy="true"
      aria-label="Loading"
    >
      <div className="bg-muted mb-3 h-3 w-2/3 max-w-xs animate-pulse rounded" />
      <div className="bg-muted h-3 w-1/2 max-w-[200px] animate-pulse rounded" />
    </div>
  );
}

export default async function CapturePage({ params }: PageProps) {
  const { vertical } = await params;
  const config = getVerticalConfig(vertical);
  if (!config) notFound();

  const chatMode = getCaptureChatModeFromEnv();

  return (
    <main className="mx-auto flex min-h-full max-w-[680px] flex-col gap-10 px-4 py-12">
      <header className="space-y-4 text-center">
        {config.eyebrow && (
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            {config.eyebrow}
          </p>
        )}
        <h1 className="text-foreground text-3xl font-semibold tracking-tight md:text-4xl">
          {config.headline}
        </h1>
        <p className="text-primary text-xl font-medium md:text-2xl">
          {config.headlineAccent}
        </p>
        <p className="text-muted-foreground mx-auto max-w-lg text-sm leading-relaxed md:text-base">
          {config.subhead}
        </p>
      </header>

      <section
        aria-label="Trust"
        className="border-border flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-y border-dashed py-4"
      >
        {config.trustItems.map((item) => (
          <span
            key={item}
            className="text-muted-foreground flex items-center gap-2 text-sm"
          >
            <span
              className="bg-emerald-600 inline-block h-1.5 w-1.5 rounded-full"
              aria-hidden
            />
            {item}
          </span>
        ))}
      </section>

      {config.disclosure ? (
        <p
          className="border-border bg-muted/40 text-foreground rounded-xl border px-4 py-3 text-center text-sm leading-relaxed"
          role="note"
        >
          {config.disclosure}
        </p>
      ) : null}

      <section className="border-border bg-card rounded-2xl border shadow-sm">
        <div className="border-border flex items-center gap-3 border-b px-4 py-3">
          <span
            className="bg-primary/15 text-primary flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold"
            aria-hidden
          >
            {config.chatAvatarLabel}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{config.chatCardTitle}</p>
            <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <span
                className="bg-emerald-600 inline-block h-2 w-2 rounded-full"
                aria-hidden
              />
              {config.onlineStatusText}
            </p>
          </div>
        </div>
        <div className="p-4">
          <Suspense fallback={<ChatFallback />}>
            <CaptureExperience config={config} chatMode={chatMode} />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
