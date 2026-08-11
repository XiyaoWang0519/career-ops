"use client";

import { cn } from "@/lib/cn";

export type SelectionAction = {
  id: string;
  label: string;
  onClick: () => void;
  tone?: "default" | "danger";
};

/** Highlight selection → hand to agent (Beautiful UI #19). */
export function SelectionActions({
  selectedText,
  actions,
  onClear,
  className,
}: {
  selectedText?: string;
  actions: SelectionAction[];
  onClear?: () => void;
  className?: string;
}) {
  if (!selectedText?.trim() || actions.length === 0) return null;

  return (
    <div
      className={cn(
        "sticky bottom-3 z-20 mx-auto flex max-w-xl flex-wrap items-center gap-1 rounded-full border border-border bg-surface/95 px-2 py-1.5 shadow-lg backdrop-blur",
        className,
      )}
    >
      <span className="max-w-[8rem] truncate px-2 text-[11px] text-faint" title={selectedText}>
        “{selectedText.trim().slice(0, 48)}{selectedText.trim().length > 48 ? "…" : ""}”
      </span>
      {actions.map((a) => (
        <button
          key={a.id}
          type="button"
          onClick={a.onClick}
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-medium transition max-sm:min-h-[40px]",
            a.tone === "danger"
              ? "text-rose-600 hover:bg-rose-500/10 dark:text-rose-400"
              : "text-foreground hover:bg-surface-hover",
          )}
        >
          {a.label}
        </button>
      ))}
      {onClear && (
        <button
          type="button"
          onClick={onClear}
          className="rounded-full px-2 py-1 text-[11px] text-faint hover:text-muted max-sm:min-h-[40px]"
        >
          Clear
        </button>
      )}
    </div>
  );
}
