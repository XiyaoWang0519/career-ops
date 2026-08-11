"use client";

import { cn } from "@/lib/cn";

/** Streaming answer with follow-ups (Beautiful UI #03). */
export function StreamingBlock({
  children,
  sourcesCount,
  followUps = [],
  onFollowUp,
  className,
  streaming,
}: {
  children: React.ReactNode;
  sourcesCount?: number;
  followUps?: string[];
  onFollowUp?: (q: string) => void;
  className?: string;
  streaming?: boolean;
}) {
  return (
    <div className={cn("rounded-2xl border border-border bg-surface/40 p-4", className)}>
      <div className={cn("text-sm leading-relaxed text-foreground", streaming && "co-stream-caret")}>
        {children}
      </div>
      {sourcesCount != null && sourcesCount > 0 && (
        <p className="mt-3 text-[11px] font-medium text-faint">{sourcesCount} sources</p>
      )}
      {followUps.length > 0 && (
        <div className="mt-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">Follow-ups</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {followUps.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => onFollowUp?.(q)}
                className="rounded-full border border-border bg-background/50 px-3 py-1.5 text-xs text-muted transition hover:border-brand/40 hover:text-foreground max-sm:min-h-[44px]"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}
      <style>{`
        .co-stream-caret::after {
          content: "";
          display: inline-block;
          width: 0.45em;
          height: 1em;
          margin-left: 2px;
          vertical-align: text-bottom;
          background: var(--color-brand);
          animation: cli-cursor-pulse 1s infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .co-stream-caret::after { animation: none; opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
