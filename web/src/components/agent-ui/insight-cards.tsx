"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";

export type InsightItem = {
  id: string;
  headline: React.ReactNode;
  detail?: React.ReactNode;
  ctaLabel?: string;
  onCta?: () => void;
  bars?: { label: string; value: string; tone?: "up" | "down" | "flat" }[];
};

/** Paged agent insights (Beautiful UI #16). */
export function InsightCards({
  items,
  className,
}: {
  items: InsightItem[];
  className?: string;
}) {
  const [idx, setIdx] = useState(0);
  if (items.length === 0) return null;
  const safe = ((idx % items.length) + items.length) % items.length;
  const item = items[safe];

  return (
    <div className={cn("rounded-2xl border border-border bg-surface/50 p-5", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-faint">
          <Sparkles className="size-3 text-brand" /> Insights
          <span className="tabular-nums text-muted">{safe + 1}/{items.length}</span>
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Previous insight"
            onClick={() => setIdx((i) => i - 1)}
            className="rounded-md p-1.5 text-muted hover:bg-surface-hover hover:text-foreground max-sm:min-h-[44px] max-sm:min-w-[44px]"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Next insight"
            onClick={() => setIdx((i) => i + 1)}
            className="rounded-md p-1.5 text-muted hover:bg-surface-hover hover:text-foreground max-sm:min-h-[44px] max-sm:min-w-[44px]"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <div className="mt-3 text-base leading-snug text-foreground">{item.headline}</div>
      {item.detail && <div className="mt-2 text-sm text-muted">{item.detail}</div>}

      {item.bars && item.bars.length > 0 && (
        <ul className="mt-4 grid gap-2 sm:grid-cols-3">
          {item.bars.map((b) => (
            <li key={b.label} className="rounded-xl border border-border bg-background/40 px-3 py-2">
              <p className="text-[11px] text-faint">{b.label}</p>
              <p
                className={cn(
                  "mt-0.5 text-sm font-semibold tabular-nums",
                  b.tone === "up" && "text-emerald-600 dark:text-emerald-400",
                  b.tone === "down" && "text-rose-600 dark:text-rose-400",
                  (!b.tone || b.tone === "flat") && "text-foreground",
                )}
              >
                {b.value}
              </p>
            </li>
          ))}
        </ul>
      )}

      {item.onCta && item.ctaLabel && (
        <button
          type="button"
          onClick={item.onCta}
          className="mt-4 text-sm font-medium text-brand-text hover:underline max-sm:min-h-[44px]"
        >
          {item.ctaLabel}
        </button>
      )}
    </div>
  );
}
