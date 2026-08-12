"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Activity, AlertTriangle, Check, Clock3, Loader2, Trash2 } from "lucide-react";
import { useJobs, type Job } from "@/components/jobs/job-store";
import { usePipeline } from "@/components/pipeline/pipeline-provider";
import { CompanyLogo } from "@/components/company-logo";
import { relatedApplicationForJob } from "@/lib/opportunity";
import { cn } from "@/lib/cn";

type ActivityGroup = {
  key: string;
  application: ReturnType<typeof relatedApplicationForJob>;
  jobs: Job[];
  startedAt: number;
};

function relativeTime(timestamp: number): string {
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function runLabel(job: Job): string {
  if (job.kind === "evaluate") return "Evaluation";
  if (job.kind === "pdf") return "Tailored CV";
  if (job.kind === "research") return "Research";
  return job.title;
}

export default function JobsHistory() {
  const { jobs, clearFinished } = useJobs();
  const { applications } = usePipeline();

  const groups = useMemo(() => {
    const map = new Map<string, ActivityGroup>();
    for (const job of jobs) {
      const application = relatedApplicationForJob(job, applications);
      const key = application ? `opportunity-${application.n}` : `run-${job.id}`;
      const group = map.get(key) ?? { key, application, jobs: [], startedAt: job.startedAt };
      group.jobs.push(job);
      group.startedAt = Math.max(group.startedAt, job.startedAt);
      if (!group.application && application) group.application = application;
      map.set(key, group);
    }
    return [...map.values()].sort((a, b) => b.startedAt - a.startedAt);
  }, [jobs, applications]);

  return (
    <div className="mx-auto max-w-4xl px-6 py-10 max-sm:pb-24">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl tracking-tight text-landing">Activity</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Work is grouped by opportunity, so an evaluation, tailored CV, and research no longer look like unrelated jobs.
          </p>
        </div>
        {jobs.some((job) => job.status !== "running") && (
          <button onClick={clearFinished} className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs text-muted transition-colors hover:bg-surface-hover hover:text-foreground">
            <Trash2 className="size-3.5" /> Clear view
          </button>
        )}
      </div>

      {groups.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border bg-surface/30 px-6 py-12 text-center text-sm text-muted">
          <Activity className="mx-auto mb-3 size-5 text-brand" />
          Work you start from an opportunity will appear here as one connected timeline.
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {groups.map((group) => {
            const latest = group.jobs[0];
            const running = group.jobs.some((job) => job.status === "running");
            const failed = group.jobs.some((job) => job.status === "error");
            const href = group.application ? `/pipeline/${group.application.n}` : `/jobs/${latest.id}`;
            const company = group.application?.company ?? latest.title.replace(/^(?:Score|Evaluate|CV PDF)\s*·\s*/i, "");
            const role = group.application?.role ?? latest.subtitle ?? latest.result?.summary ?? "Unlinked activity";
            return (
              <li key={group.key} id={group.key} className="scroll-mt-6 overflow-hidden rounded-2xl border border-border bg-surface/40">
                <Link href={href} className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface-hover">
                  <CompanyLogo name={company} size={28} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">{company}</span>
                    <span className="mt-0.5 block truncate text-xs text-muted">{role}</span>
                  </span>
                  <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium", running ? "bg-brand-soft text-brand" : failed ? "bg-red-500/10 text-red-500" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400") }>
                    {running ? <Loader2 className="size-3 animate-spin" /> : failed ? <AlertTriangle className="size-3" /> : <Check className="size-3" />}
                    {running ? "Working" : `${group.jobs.length} run${group.jobs.length === 1 ? "" : "s"}`}
                  </span>
                </Link>
                <ol className="border-t border-border px-4 py-2">
                  {group.jobs.slice(0, 4).map((job) => (
                    <li key={job.id} className="flex items-center gap-2.5 py-1.5 text-xs">
                      <span className={cn("size-1.5 shrink-0 rounded-full", job.status === "running" ? "bg-brand" : job.status === "error" ? "bg-red-400" : "bg-emerald-400")} />
                      <Link href={`/jobs/${job.id}`} className="min-w-0 flex-1 truncate text-muted transition-colors hover:text-brand">{runLabel(job)}</Link>
                      {job.result?.score != null && <span className="font-medium tabular-nums text-foreground">{job.result.score}/5</span>}
                      <span className="inline-flex shrink-0 items-center gap-1 text-faint"><Clock3 className="size-3" />{relativeTime(job.startedAt)}</span>
                    </li>
                  ))}
                </ol>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
