"use client";

import { cn } from "@/lib/cn";

export type FilterChip = {
  id: string;
  label: string;
  count?: number;
};

/** Status chips that reorganize live data (Beautiful UI #13). */
export function FilterChips({
  chips,
  value,
  onChange,
  className,
}: {
  chips: FilterChip[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)} role="tablist">
      {chips.map((chip) => {
        const active = value === chip.id;
        return (
          <button
            key={chip.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(chip.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition max-sm:min-h-[44px]",
              active
                ? "border-brand/40 bg-brand-soft text-brand-text"
                : "border-border bg-surface/50 text-muted hover:text-foreground",
            )}
          >
            {chip.label}
            {chip.count != null && (
              <span className={cn("tabular-nums", active ? "text-brand-text/80" : "text-faint")}>{chip.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
