import { cn } from "@/lib/cn";
import { Check, Loader2, Wrench, X } from "lucide-react";

export type ToolChipItem = {
  id: string;
  label: string;
  status?: "running" | "done" | "error";
};

/** Compact tool-call chips (Beautiful UI #05). */
export function ToolChips({
  items,
  summary,
  className,
}: {
  items: ToolChipItem[];
  summary?: string;
  className?: string;
}) {
  if (items.length === 0 && !summary) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {summary && (
        <span className="mr-1 text-[11px] text-faint">{summary}</span>
      )}
      {items.map((item) => {
        const status = item.status ?? "done";
        return (
          <span
            key={item.id}
            className={cn(
              "inline-flex max-w-[14rem] items-center gap-1.5 truncate rounded-lg border px-2 py-1 text-[11px] font-medium",
              status === "running" && "border-brand/35 bg-brand-soft text-brand-text",
              status === "done" && "border-border bg-surface/80 text-muted",
              status === "error" && "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400",
            )}
          >
            {status === "running" ? (
              <Loader2 className="size-3 shrink-0 animate-spin" />
            ) : status === "error" ? (
              <X className="size-3 shrink-0" />
            ) : (
              <Check className="size-3 shrink-0 text-emerald-500" />
            )}
            <Wrench className="size-3 shrink-0 opacity-50" />
            <span className="truncate">{item.label}</span>
          </span>
        );
      })}
    </div>
  );
}
