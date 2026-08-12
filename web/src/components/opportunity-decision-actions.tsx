"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, X } from "lucide-react";
import { scoreNum } from "@/lib/format";
import { cn } from "@/lib/cn";

type Decision = "pursue" | "pass";

export function OpportunityDecisionActions({ n, score, compact = false }: { n: string; score: string; compact?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<Decision | "">("");
  const [saved, setSaved] = useState<Decision | "">("");
  const [error, setError] = useState("");
  const numericScore = scoreNum(score);
  const belowApplyLine = Number.isFinite(numericScore) && numericScore < 4;

  async function decide(decision: Decision) {
    setBusy(decision);
    setError("");
    try {
      const response = await fetch("/api/opportunities/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ n, decision }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error || "Could not save this decision");
      setSaved(decision);
      window.setTimeout(() => router.refresh(), 550);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save this decision");
    } finally {
      setBusy("");
    }
  }

  if (saved) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-brand" role="status">
        <Check className="size-3.5" /> {saved === "pursue" ? "Moved to Active" : "Passed"}
      </span>
    );
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", compact && "w-full")}>
      <button
        type="button"
        disabled={!!busy}
        onClick={() => decide("pursue")}
        title={belowApplyLine ? "This role is below the 4.0 apply line; review the gaps before continuing." : "Keep this opportunity and move it to Active."}
        className={cn(
          "inline-flex min-h-8 items-center justify-center gap-1 rounded-md px-2.5 text-xs font-medium transition-colors disabled:opacity-50 max-sm:min-h-[44px]",
          compact && "flex-1",
          belowApplyLine
            ? "border border-border text-muted hover:border-brand/40 hover:text-foreground"
            : "bg-brand text-brand-foreground hover:bg-brand-200",
        )}
      >
        {busy === "pursue" ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
        {belowApplyLine ? "Pursue anyway" : "Pursue"}
      </button>
      <button
        type="button"
        disabled={!!busy}
        onClick={() => decide("pass")}
        title="Pass on this opportunity and move it to Closed."
        className={cn(
          "inline-flex min-h-8 items-center justify-center gap-1 rounded-md border border-border px-2.5 text-xs font-medium text-muted transition-colors hover:border-red-400/50 hover:text-red-600 disabled:opacity-50 max-sm:min-h-[44px]",
          compact && "flex-1",
        )}
      >
        {busy === "pass" ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />} Pass
      </button>
      {error && <span className="basis-full text-left text-[11px] text-red-600" role="alert">{error}</span>}
    </div>
  );
}
