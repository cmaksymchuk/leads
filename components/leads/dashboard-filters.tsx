"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";

const STATUSES = ["available", "sold"] as const;

export function DashboardFilters() {
  const router = useRouter();
  const sp = useSearchParams();
  const [status, setStatus] = useState(sp.get("status") ?? "all");
  const [minScore, setMinScore] = useState(sp.get("min_score") ?? "");

  const apply = useCallback(() => {
    const p = new URLSearchParams();
    if (status && status !== "all") p.set("status", status);
    if (minScore) p.set("min_score", minScore);
    const detail = sp.get("detail");
    if (detail) p.set("detail", detail);
    router.push(`/dashboard?${p.toString()}`);
  }, [status, minScore, router, sp]);

  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="grid gap-2">
        <Label htmlFor="status">status</Label>
        <Select
          value={status}
          onValueChange={(v) => setStatus(v ?? "all")}
        >
          <SelectTrigger id="status" className="w-[180px]">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="min_score">min score</Label>
        <Input
          id="min_score"
          type="number"
          min={0}
          max={200}
          className="w-24"
          value={minScore}
          onChange={(e) => setMinScore(e.target.value)}
        />
      </div>
      <Button type="button" onClick={apply}>
        Apply
      </Button>
    </div>
  );
}
