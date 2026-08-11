"use client";

import { cn } from "@/lib/cn";
import { Check, ChevronRight } from "lucide-react";

export type RecommendationAlt = {
  id: string;
  label: string;
  tone?: "ok" | "review" | "weak";
};

/** Agent suggestion with confidence meter (Beautiful UI #09). */
export function RecommendationCard({
  title,
  body,
  confidence = 0.7,
  confidenceLabel = "confidence",
  alternatives = [],
  onAccept,
  onPickAlt,
  acceptLabel = "Accept",
  className,
  footer,
}: {
  title: string;
  body: React.ReactNode;
  confidence?: number;
  confidenceLabel?: string;
  alternatives?: RecommendationAlt[];
  onAccept?: () => void;
  onPickAlt?: (id: string) => void;
  acceptLabel?: string;
  className?: string;
  footer?: React.ReactNode;
}) {
  const pct = Math.round(Math.min(1, Math.max(0, confidence)) * 100);
  const tone =
    pct >= 75 ? "text-emerald-600 dark:text-emerald-400" : pct >= 50 ? "text-amber-700 dark:text-amber-400" : "text-muted";

  return (
    <div className={cn("rounded-2xl border border-border bg-surface/60 p-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-faint">Recommendation</p>
          <h3 className="mt-1 text-sm font-semibold text-foreground">{title}</h3>
        </div>
        <div className="shrink-0 text-right">
          <p className={cn("text-xs font-semibold tabular-nums", tone)}>{pct}%</p>
          <p className="text-[10px] text-faint">{confidenceLabel}</p>
        </div>
      </div>

      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-hover">
        <div
          className={cn(
            "h-full rounded-full transition-[width]",
            pct >= 75 ? "bg-emerald-500/70" : pct >= 50 ? "bg-amber-500/70" : "bg-foreground/25",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="mt-3 text-sm text-muted">{body}</div>

      {alternatives.length > 0 && (
        <div className="mt-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">Other options</p>
          <ul className="mt-1.5 space-y-1">
            {alternatives.map((alt) => (
              <li key={alt.id}>
                <button
                  type="button"
                  onClick={() => onPickAlt?.(alt.id)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-muted transition hover:bg-surface-hover hover:text-foreground max-sm:min-h-[44px]"
                >
                  <ChevronRight className="size-3.5 shrink-0 text-faint" />
                  <span className="flex-1">{alt.label}</span>
                  {alt.tone === "review" && (
                    <span className="text-[10px] uppercase tracking-wide text-amber-600 dark:text-amber-400">Needs review</span>
                  )}
                  {alt.tone === "weak" && (
                    <span className="text-[10px] uppercase tracking-wide text-faint">No signal</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        {onAccept && (
          <button
            type="button"
            onClick={onAccept}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-brand-soft px-3 py-2 text-sm font-medium text-brand-text transition hover:bg-brand/15 max-sm:min-h-[44px]"
          >
            <Check className="size-3.5" /> {acceptLabel}
          </button>
        )}
        {footer}
      </div>
    </div>
  );
}
