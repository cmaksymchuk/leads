"use client";

import { markLeadSold } from "@/app/actions/mark-lead-sold";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function MarkSoldButton({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const r = await markLeadSold(leadId);
          if (r.ok) router.refresh();
        })
      }
    >
      {pending ? "…" : "Mark as sold"}
    </Button>
  );
}
