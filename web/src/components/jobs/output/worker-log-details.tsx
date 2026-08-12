"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function WorkerLogDetails({ text }: { text: string }) {
  if (!text.trim()) return null;
  return (
    <details className="group mt-4 rounded-2xl border border-border/70 bg-surface/20">
      <summary className="cursor-pointer list-none px-5 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-faint transition-colors hover:text-muted [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-2">
          Worker log
          <span className="font-normal normal-case tracking-normal text-faint/80 group-open:hidden">— technical stream</span>
        </span>
      </summary>
      <div className="report-prose border-t border-border/60 px-5 py-4 text-sm text-muted">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
      </div>
    </details>
  );
}
