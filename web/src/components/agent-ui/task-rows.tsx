"use client";

import Link from "next/link";
import { Check, Loader2, AlertTriangle, X } from "lucide-react";
import { ThinkingOrb } from "thinking-orbs";
import { cn } from "@/lib/cn";

export type TaskRowItem = {
  id: string;
  title: string;
  detail?: string;
  meta?: string;
  status: "running" | "done" | "error" | "queued";
  progress?: number; // 0-100
  href?: string;
  onDismiss?: () => void;
};

/** Live agent task status rows (Beautiful UI #06). Keeps ThinkingOrb for running. */
export function TaskRows({
  items,
  className,
  dense,
}: {
  items: TaskRowItem[];
  className?: string;
  dense?: boolean;
}) {
  if (items.length === 0) return null;

  return (
    <ul className={cn("overflow-hidden rounded-2xl border border-border bg-surface/40", className)}>
      {items.map((item, i) => {
        const running = item.status === "running";
        const body = (
            <>
              <span className="mt-0.5 shrink-0">
                {running ? (
                  <ThinkingOrb state="working" size={20} aria-label="Running" />
                ) : item.status === "error" ? (
                  <AlertTriangle className="size-4 text-rose-500" />
                ) : item.status === "queued" ? (
                  <Loader2 className="size-4 text-faint" />
                ) : (
                  <Check className="size-4 text-emerald-500" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-[10px] tabular-nums text-faint">{i + 1}</span>
                  <p className={cn("truncate font-medium text-foreground", dense ? "text-xs" : "text-sm")}>
                    {item.title}
                  </p>
                  {item.meta && (
                    <span className="ml-auto shrink-0 text-[11px] tabular-nums text-faint">{item.meta}</span>
                  )}
                </div>
                {item.detail && (
                  <p className={cn("mt-0.5 truncate text-muted", dense ? "text-[10px]" : "text-xs")}>
                    {item.detail}
                  </p>
                )}
                {(running || item.progress != null) && (
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-hover">
                    {running && item.progress == null ? (
                      <div className="job-indeterminate h-full w-full" />
                    ) : (
                      <div
                        className="h-full rounded-full bg-brand/70 transition-[width] duration-300"
                        style={{ width: `${Math.min(100, Math.max(0, item.progress ?? 0))}%` }}
                      />
                    )}
                  </div>
                )}
              </div>
            </>
          );

        return (
          <li
            key={item.id}
            className={cn(
              "group flex items-start gap-2 border-b border-border last:border-b-0",
              dense ? "px-2 py-2" : "px-3 py-3",
            )}
          >
            {item.href ? (
              <Link
                href={item.href}
                className={cn(
                  "flex min-w-0 flex-1 items-start gap-3 rounded-lg transition-colors hover:bg-surface-hover/60",
                  dense ? "px-1 py-0.5" : "px-1 py-1",
                )}
              >
                {body}
              </Link>
            ) : (
              <div className="flex min-w-0 flex-1 items-start gap-3">{body}</div>
            )}
            {item.onDismiss && (
              <button
                type="button"
                onClick={item.onDismiss}
                className="mt-1 shrink-0 rounded p-1 text-faint opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100 max-sm:min-h-[44px] max-sm:min-w-[44px] max-sm:opacity-100"
                aria-label={`Dismiss ${item.title}`}
              >
                <X className="size-3" />
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
