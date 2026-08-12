"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X, History, ChevronDown } from "lucide-react";
import { useJobs } from "@/components/jobs/job-store";
import { WorkerCard, pillTone, TONE } from "@/components/jobs/worker-card";
import { cn } from "@/lib/cn";

// Back-compat re-exports (app/jobs/page.tsx imports pillTone from here).
export { pillTone, TONE };

// Collapsed "worker" pills in the sidebar — each the shared <WorkerCard> wrapped
// in a Link to its detail. Same component the assistant chat renders inline.
// The list itself is a foldable accordion so a busy tray doesn't eat the sidebar.
export function WorkerPills() {
  const { jobs, removeJob, clearFinished } = useJobs();
  const pathname = usePathname();
  const running = jobs.filter((j) => j.status === "running").length;
  // Start open when something is in flight; finished-only trays stay collapsed.
  const [open, setOpen] = useState(() => running > 0);
  const prevRunning = useRef(running);

  // Re-expand only when a new worker starts — never fight a manual collapse on finish.
  useEffect(() => {
    if (running > prevRunning.current) setOpen(true);
    prevRunning.current = running;
  }, [running]);

  if (jobs.length === 0) return null;
  const finished = jobs.length - running;

  return (
    <div className="t-acc mt-4 border-t border-border pt-3" data-open={open ? "true" : "false"}>
      <div className="mb-2 flex items-center gap-2 px-1">
        <button
          type="button"
          className="t-acc-head flex min-w-0 flex-1 items-center gap-2 text-left"
          aria-expanded={open ? "true" : "false"}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-faint">Workers</span>
          {running > 0 && <span className="text-[10px] tabular-nums text-brand">{running} running</span>}
          <span className="t-acc-chevron text-faint" aria-hidden="true">
            <ChevronDown className="size-3.5" />
          </span>
        </button>
        <Link href="/jobs" className="text-faint transition-colors hover:text-foreground" title="History" aria-label="Worker history">
          <History className="size-3.5" />
        </Link>
        {finished > 0 && (
          <button onClick={clearFinished} className="text-[10px] text-faint transition-colors hover:text-foreground" title="Clear finished">
            clear
          </button>
        )}
      </div>
      <div className="t-acc-panel">
        <div className="t-acc-panel-inner">
          <ul className="space-y-1.5">
            {jobs.slice(0, 6).map((j) => {
              const active = pathname === `/jobs/${j.id}`;
              return (
                <li key={j.id}>
                  <Link
                    href={`/jobs/${j.id}`}
                    className={cn(
                      "group block rounded-lg border px-2.5 py-2 transition-colors",
                      active ? "border-brand/50 bg-brand-soft" : "border-border bg-surface/60 hover:bg-surface-hover",
                    )}
                  >
                    <WorkerCard
                      job={j}
                      variant="tray"
                      trailing={
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            removeJob(j.id);
                          }}
                          className="text-faint opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                          aria-label="Dismiss job"
                        >
                          <X className="size-3" />
                        </button>
                      }
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
