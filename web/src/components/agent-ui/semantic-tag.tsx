import { cn } from "@/lib/cn";

/** Multi-color semantic tags — orange is reserved for brand/active, not tags. */
const PALETTE = {
  emerald: "bg-emerald-500/12 text-emerald-700 border-emerald-500/25 dark:text-emerald-400",
  sky: "bg-sky-500/12 text-sky-700 border-sky-500/25 dark:text-sky-400",
  violet: "bg-violet-500/12 text-violet-700 border-violet-500/25 dark:text-violet-400",
  amber: "bg-amber-500/12 text-amber-800 border-amber-500/25 dark:text-amber-400",
  rose: "bg-rose-500/12 text-rose-700 border-rose-500/25 dark:text-rose-400",
  teal: "bg-teal-500/12 text-teal-700 border-teal-500/25 dark:text-teal-400",
  lime: "bg-lime-500/12 text-lime-800 border-lime-500/25 dark:text-lime-400",
  zinc: "bg-surface-hover text-muted border-border",
} as const;

export type SemanticTagTone = keyof typeof PALETTE;

const ATS_TONES: Record<string, SemanticTagTone> = {
  greenhouse: "emerald",
  lever: "sky",
  ashby: "violet",
  workday: "amber",
  icims: "teal",
};

export function toneForAts(ats: string | null | undefined): SemanticTagTone {
  if (!ats) return "zinc";
  return ATS_TONES[ats.toLowerCase()] ?? "zinc";
}

export function toneForScore(score: number | null | undefined): SemanticTagTone {
  if (score == null || Number.isNaN(score)) return "zinc";
  if (score >= 4.5) return "emerald";
  if (score >= 4) return "teal";
  if (score >= 3) return "amber";
  return "rose";
}

export function SemanticTag({
  children,
  tone = "zinc",
  className,
}: {
  children: React.ReactNode;
  tone?: SemanticTagTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        PALETTE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
