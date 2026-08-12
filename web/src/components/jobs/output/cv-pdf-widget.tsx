"use client";

import { ExternalLink, FileText } from "lucide-react";

export function CvPdfWidget({
  company,
  href,
  reportNum,
}: {
  company: string;
  href: string;
  reportNum: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface/40 px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">Tailored CV</p>
          <p className="mt-1 font-display text-lg tracking-tight text-landing">{company}</p>
          <p className="text-sm text-muted">PDF for application #{reportNum}</p>
        </div>
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-500/15 dark:text-emerald-400"
        >
          <FileText className="size-3.5" /> Open PDF <ExternalLink className="size-3 opacity-70" />
        </a>
      </div>
      <div className="mt-4 overflow-hidden rounded-xl border border-border bg-bg">
        <iframe title={`Tailored CV — ${company}`} src={href} className="h-[32rem] w-full" />
      </div>
    </div>
  );
}
