"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Loader2, X } from "lucide-react";
import { useJobs } from "@/components/jobs/job-store";
import { WorkerReasoningTrace } from "@/components/jobs/worker-reasoning-trace";
import { JobOutputShowcase } from "@/components/jobs/output/job-output-showcase";
import { usePipeline } from "@/components/pipeline/pipeline-provider";
import { HeroGlow } from "@/components/hero-glow";
import { Badge } from "@/components/ui/badge";
import { relatedApplicationForJob } from "@/lib/opportunity";
import { cn } from "@/lib/cn";

export default function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { jobs } = useJobs();
  const { applications } = usePipeline();
  const job = jobs.find((j) => j.id === id);
  const related = job ? relatedApplicationForJob(job, applications) : null;

  if (!job) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Link href="/jobs" className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-brand">
          <ArrowLeft className="size-4" /> Activity
        </Link>
        <p className="mt-8 text-sm text-muted">
          This worker is no longer available (it finished earlier, or the server was restarted).
        </p>
      </div>
    );
  }

  const done = job.status === "done";
  const errored = job.status === "error";
  const running = job.status === "running";

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <Link href={related ? `/pipeline/${related.n}` : "/jobs"} className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-brand">
        <ArrowLeft className="size-4" /> {related ? `${related.company} opportunity` : "Activity"}
      </Link>

      <section
        className={cn(
          "dot-bg relative mt-5 min-h-[9.5rem] overflow-hidden rounded-2xl border px-6 py-7 transition-[background-color,border-color,box-shadow] duration-very-slow ease-smooth-out",
          running && "border-border bg-surface/40",
          done && "border-emerald-500/40 bg-emerald-500/[0.09] shadow-[inset_0_0_90px_-28px_rgba(16,185,129,0.55)]",
          errored && "border-red-400/35 bg-red-500/[0.06]",
        )}
      >
        {running && <HeroGlow />}
        {done && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_top_left,rgba(16,185,129,0.22),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(16,185,129,0.12),transparent_50%)] transition-opacity duration-very-slow ease-smooth-out"
          />
        )}
        <div className="relative z-10">
          <p
            className={cn(
              "flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] transition-colors duration-very-slow",
              running && "text-brand-text",
              done && "text-emerald-700 dark:text-emerald-400",
              errored && "text-red-500",
            )}
          >
            {running ? (
              <><Loader2 className="size-3 animate-spin text-brand" /> working</>
            ) : done ? (
              <><Check className="size-3 text-emerald-500" /> done</>
            ) : (
              <><X className="size-3 text-red-400" /> error</>
            )}
          </p>
          <h1 className="mt-2 font-display text-2xl tracking-tight text-landing">{job.title}</h1>
          {job.subtitle && <p className="mt-1 text-sm text-muted">{job.subtitle}</p>}
          {job.result?.score != null && (
            <div className="mt-3 flex flex-wrap items-center gap-2.5">
              <Badge tone={job.result.tone}>{job.result.score}/5</Badge>
              {job.result.summary && <span className="text-sm text-muted">{job.result.summary}</span>}
            </div>
          )}
        </div>
      </section>

      <WorkerReasoningTrace job={job} />

      <JobOutputShowcase job={job} related={related} />
    </div>
  );
}
