"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { legitimacyTone, scoreTone } from "@/lib/format";

const SCORE_RING = {
  good: { stroke: "stroke-emerald-500", text: "text-emerald-700 dark:text-emerald-400", wash: "from-emerald-500/[0.08]" },
  warn: { stroke: "stroke-amber-500", text: "text-amber-700 dark:text-amber-400", wash: "from-amber-500/[0.08]" },
  bad: { stroke: "stroke-red-400", text: "text-red-600 dark:text-red-400", wash: "from-red-500/[0.07]" },
  muted: { stroke: "stroke-faint/50", text: "text-muted", wash: "from-transparent" },
} as const;

function ScoreRing({ score, tone }: { score: number; tone: keyof typeof SCORE_RING }) {
  const r = 28;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, score / 5));
  const dash = c * pct;
  const colors = SCORE_RING[tone];

  return (
    <div className="relative flex size-[4.25rem] shrink-0 items-center justify-center" aria-label={`Score ${score} out of 5`}>
      <svg viewBox="0 0 64 64" className="absolute inset-0 size-full -rotate-90" aria-hidden>
        <circle cx="32" cy="32" r={r} fill="none" className="stroke-border/80" strokeWidth="3.5" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          className={cn(colors.stroke, "transition-[stroke-dasharray] duration-700 ease-out")}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
        />
      </svg>
      <div className="relative z-[1] flex flex-col items-center leading-none">
        <span className={cn("font-display text-[1.65rem] tracking-tight tabular-nums", colors.text)}>{score}</span>
        <span className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-faint">/ 5</span>
      </div>
    </div>
  );
}

export function ScorecardWidget({
  score,
  summary,
  legitimacy: legitimacyProp,
  href,
  reportNum,
}: {
  score: number | null;
  summary: string;
  legitimacy?: string | null;
  href?: string;
  reportNum?: string;
}) {
  const [legitimacy, setLegitimacy] = useState<string | null | undefined>(legitimacyProp);

  useEffect(() => {
    setLegitimacy(legitimacyProp);
  }, [legitimacyProp]);

  useEffect(() => {
    if (legitimacyProp || !reportNum) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/report/${encodeURIComponent(reportNum)}`);
        if (!res.ok) return;
        const json = (await res.json()) as { meta?: { legitimacy?: string | null } };
        if (!cancelled && json.meta?.legitimacy) setLegitimacy(json.meta.legitimacy);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [legitimacyProp, reportNum]);

  const tone = score != null ? scoreTone(`${score}`) : "muted";
  const wash = SCORE_RING[tone].wash;
  const legitTone = legitimacy ? legitimacyTone(legitimacy) : "muted";

  const inner = (
    <div className="relative flex items-center gap-5">
      {score != null ? (
        <ScoreRing score={score} tone={tone} />
      ) : (
        <div className="flex size-[4.25rem] shrink-0 items-center justify-center rounded-full border border-dashed border-border">
          <span className="font-mono text-xs text-faint">n/a</span>
        </div>
      )}

      <div className="min-w-0 flex-1 py-0.5">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-faint">Fit verdict</p>
        {summary ? (
          <p className="mt-1.5 font-display text-[1.05rem] leading-snug tracking-tight text-landing">{summary}</p>
        ) : (
          <p className="mt-1.5 text-sm text-muted">Open the full report for the breakdown.</p>
        )}
        {legitimacy ? (
          <p
            className={cn(
              "mt-2.5 text-[11px] font-medium tracking-wide",
              legitTone === "good" && "text-emerald-700 dark:text-emerald-400",
              legitTone === "warn" && "text-amber-700 dark:text-amber-400",
              legitTone === "bad" && "text-red-600 dark:text-red-400",
              legitTone === "muted" && "text-muted",
            )}
          >
            {legitimacy}
          </p>
        ) : null}
      </div>

      {href ? (
        <span
          className="hidden size-9 shrink-0 items-center justify-center rounded-lg border border-border/80 text-faint transition-colors group-hover:border-brand/35 group-hover:text-brand sm:inline-flex"
          aria-hidden
        >
          <ArrowUpRight className="size-4" />
        </span>
      ) : null}
    </div>
  );

  const shell = cn(
    "group relative block overflow-hidden rounded-2xl border border-border bg-surface px-5 py-5",
    "bg-gradient-to-br to-transparent",
    wash,
    href &&
      "transition-[border-color,transform] duration-200 hover:-translate-y-px hover:border-brand/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
  );

  if (href) {
    return (
      <Link href={href} className={shell}>
        {inner}
      </Link>
    );
  }

  return <div className={shell}>{inner}</div>;
}
