"use client";

import { cn } from "@/lib/cn";
import { Check, X } from "lucide-react";

export type DiffCell = {
  key: string;
  label: string;
  before?: string;
  after: string;
  accepted?: boolean;
};

/** AI-proposed edits over structured fields (Beautiful UI #11). */
export function DiffTable({
  title = "Proposed edits",
  rows,
  onAccept,
  onReject,
  onAcceptAll,
  className,
}: {
  title?: string;
  rows: DiffCell[];
  onAccept?: (key: string) => void;
  onReject?: (key: string) => void;
  onAcceptAll?: () => void;
  className?: string;
}) {
  if (rows.length === 0) return null;
  const pending = rows.filter((r) => !r.accepted).length;

  return (
    <div className={cn("overflow-hidden rounded-2xl border border-border", className)}>
      <div className="flex items-center justify-between gap-2 border-b border-border bg-surface/60 px-4 py-2.5">
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="text-[11px] text-faint">{pending} pending · {rows.length} fields</p>
        </div>
        {onAcceptAll && pending > 0 && (
          <button
            type="button"
            onClick={onAcceptAll}
            className="rounded-md bg-brand-soft px-2.5 py-1.5 text-xs font-medium text-brand-text hover:bg-brand/15 max-sm:min-h-[44px]"
          >
            Accept all
          </button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface/40 text-left text-[10px] uppercase tracking-wide text-faint">
            <tr>
              <th className="px-4 py-2 font-medium">Field</th>
              <th className="px-4 py-2 font-medium">Before</th>
              <th className="px-4 py-2 font-medium">Proposed</th>
              <th className="px-4 py-2 font-medium"> </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.key} className={cn(r.accepted && "bg-emerald-500/5")}>
                <td className="px-4 py-2.5 font-medium text-foreground">{r.label}</td>
                <td className="px-4 py-2.5 text-faint line-through decoration-rose-400/50">
                  {r.before?.trim() ? r.before : "—"}
                </td>
                <td className="px-4 py-2.5 text-foreground">
                  <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-emerald-800 dark:text-emerald-300">
                    {r.after || "—"}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center justify-end gap-1">
                    {r.accepted ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                        <Check className="size-3.5" /> kept
                      </span>
                    ) : (
                      <>
                        {onAccept && (
                          <button
                            type="button"
                            aria-label={`Accept ${r.label}`}
                            onClick={() => onAccept(r.key)}
                            className="rounded-md p-1.5 text-emerald-600 hover:bg-emerald-500/10 max-sm:min-h-[44px] max-sm:min-w-[44px]"
                          >
                            <Check className="size-4" />
                          </button>
                        )}
                        {onReject && (
                          <button
                            type="button"
                            aria-label={`Reject ${r.label}`}
                            onClick={() => onReject(r.key)}
                            className="rounded-md p-1.5 text-muted hover:bg-surface-hover hover:text-foreground max-sm:min-h-[44px] max-sm:min-w-[44px]"
                          >
                            <X className="size-4" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
