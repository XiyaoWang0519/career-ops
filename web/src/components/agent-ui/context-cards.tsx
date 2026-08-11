import { cn } from "@/lib/cn";
import { FileText } from "lucide-react";
import { SemanticTag, type SemanticTagTone } from "@/components/agent-ui/semantic-tag";

export type ContextChunk = {
  id: string;
  title: string;
  body: string;
  chars?: number;
  sourceLabel?: string;
  sourceKind?: string;
  tone?: SemanticTagTone;
};

/** Retrieved knowledge chunks (Beautiful UI #10). */
export function ContextCards({
  chunks,
  totalLabel,
  className,
}: {
  chunks: ContextChunk[];
  totalLabel?: string;
  className?: string;
}) {
  if (chunks.length === 0) return null;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-faint">Context</p>
        {totalLabel && <span className="text-[11px] text-faint">{totalLabel}</span>}
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {chunks.map((c) => (
          <li key={c.id} className="rounded-xl border border-border bg-surface/50 p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-foreground">{c.title}</p>
              {c.chars != null && (
                <span className="shrink-0 font-mono text-[10px] tabular-nums text-faint">{c.chars} chars</span>
              )}
            </div>
            <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-muted">{c.body}</p>
            {(c.sourceLabel || c.sourceKind) && (
              <div className="mt-2 flex items-center gap-1.5">
                <FileText className="size-3 text-faint" />
                {c.sourceKind && <SemanticTag tone={c.tone ?? "zinc"}>{c.sourceKind}</SemanticTag>}
                {c.sourceLabel && <span className="truncate text-[11px] text-faint">{c.sourceLabel}</span>}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
