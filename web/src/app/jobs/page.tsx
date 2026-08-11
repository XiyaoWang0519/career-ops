"use client";

import Link from "next/link";
import { Trash2 } from "lucide-react";
import { useJobs } from "@/components/jobs/job-store";
import { TaskRows, type TaskRowItem } from "@/components/agent-ui/task-rows";

export default function JobsHistory() {
  const { jobs, clearFinished, removeJob } = useJobs();

  const items: TaskRowItem[] = jobs.map((j) => ({
    id: j.id,
    title: j.title,
    detail: j.result?.summary || j.subtitle,
    meta: j.result?.score != null ? `${j.result.score}/5` : j.status,
    status: j.status === "running" ? "running" : j.status === "error" ? "error" : "done",
    href: `/jobs/${j.id}`,
    onDismiss: () => removeJob(j.id),
  }));

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-2xl tracking-tight text-landing">Activity</h1>
          <p className="mt-1 text-sm text-muted">
            Everything you&apos;ve run — evaluations, CV drafts, and research. <span className="tabular-nums">{jobs.length}</span> total.
          </p>
        </div>
        {jobs.some((j) => j.status !== "running") && (
          <button
            onClick={clearFinished}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:bg-surface-hover hover:text-foreground max-sm:min-h-[44px]"
          >
            <Trash2 className="size-3.5" /> Clear finished
          </button>
        )}
      </div>

      {jobs.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border bg-surface/30 px-6 py-12 text-center text-sm text-muted">
          Nothing here yet. Hit <span className="text-foreground">Evaluate</span> on a job to see it show up.
        </div>
      ) : (
        <div className="mt-6">
          <TaskRows items={items} />
        </div>
      )}
    </div>
  );
}
