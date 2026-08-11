"use client";

import Link from "next/link";
import { History } from "lucide-react";
import { useEffect, useState } from "react";
import { useJobs } from "@/components/jobs/job-store";
import { pillTone, TONE } from "@/components/jobs/worker-card";
import { TaskRows, type TaskRowItem } from "@/components/agent-ui/task-rows";

// Back-compat re-exports (app/jobs/page.tsx imports pillTone from here).
export { pillTone, TONE };

function fmtElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Collapsed workers tray — Task Rows (Beautiful UI #06); orb via TaskRows. */
export function WorkerPills() {
  const { jobs, removeJob, clearFinished } = useJobs();
  const [now, setNow] = useState(Date.now());
  const running = jobs.filter((j) => j.status === "running").length;
  const finished = jobs.length - running;

  useEffect(() => {
    if (running === 0) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running]);

  if (jobs.length === 0) return null;

  const items: TaskRowItem[] = jobs.slice(0, 6).map((j) => {
    const last = j.steps[j.steps.length - 1]?.label;
    const detail =
      j.status === "done" && j.result?.summary
        ? j.result.summary
        : last ?? (j.status === "running" ? "Working…" : undefined);
    const elapsed = j.status === "running" ? fmtElapsed(now - j.startedAt) : undefined;
    return {
      id: j.id,
      title: j.title,
      detail,
      meta: j.result?.score != null ? String(j.result.score) : elapsed,
      status: j.status === "running" ? "running" : j.status === "error" ? "error" : "done",
      href: `/jobs/${j.id}`,
      onDismiss: () => removeJob(j.id),
    };
  });

  return (
    <div className="mt-4 border-t border-border pt-3">
      <div className="mb-2 flex items-center gap-2 px-1">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-faint">Workers</span>
        {running > 0 && <span className="text-[10px] tabular-nums text-brand">{running} running</span>}
        <Link href="/jobs" className="ml-auto text-faint transition-colors hover:text-foreground" title="History" aria-label="Worker history">
          <History className="size-3.5" />
        </Link>
        {finished > 0 && (
          <button onClick={clearFinished} className="text-[10px] text-faint transition-colors hover:text-foreground" title="Clear finished">
            clear
          </button>
        )}
      </div>
      <TaskRows items={items} dense />
    </div>
  );
}
