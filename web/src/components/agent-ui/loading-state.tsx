"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

/** Pixel-grid loader with shimmer and elapsed time (Beautiful UI #01). */
export function LoadingState({
  label = "Working",
  className,
  startedAt,
}: {
  label?: string;
  className?: string;
  startedAt?: number;
}) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = startedAt ?? Date.now();
    const tick = () => setElapsed(Math.max(0, Date.now() - start));
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [startedAt]);

  const secs = (elapsed / 1000).toFixed(1);

  return (
    <div
      className={cn(
        "inline-flex items-center gap-3 rounded-2xl border border-border bg-surface/70 px-4 py-3",
        className,
      )}
      role="status"
      aria-live="polite"
      aria-label={`${label}, ${secs} seconds`}
    >
      <PixelGrid />
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-faint">{label}</p>
        <p className="mt-0.5 font-mono text-xs tabular-nums text-muted">{secs}s</p>
      </div>
    </div>
  );
}

function PixelGrid() {
  return (
    <div className="grid size-8 grid-cols-4 gap-0.5" aria-hidden>
      {Array.from({ length: 16 }, (_, i) => (
        <span
          key={i}
          className="co-pixel block rounded-[1px] bg-brand/35"
          style={{ animationDelay: `${(i % 4) * 90 + Math.floor(i / 4) * 40}ms` }}
        />
      ))}
      <style>{`
        @keyframes co-pixel-pulse {
          0%, 100% { opacity: 0.25; transform: scale(0.85); }
          50% { opacity: 1; transform: scale(1); }
        }
        .co-pixel { animation: co-pixel-pulse 1.2s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .co-pixel { animation: none; opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}
