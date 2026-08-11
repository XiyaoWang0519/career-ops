import { cn } from "@/lib/cn";

export type RecordsColumn<T> = {
  key: string;
  header: string;
  className?: string;
  sortable?: boolean;
  render: (row: T) => React.ReactNode;
};

/** CRM-style records grid chrome (Beautiful UI #12). */
export function RecordsTable<T extends { id: string }>({
  columns,
  rows,
  onSort,
  sortKey,
  sortDir,
  footer,
  className,
  onRowClick,
}: {
  columns: RecordsColumn<T>[];
  rows: T[];
  onSort?: (key: string) => void;
  sortKey?: string;
  sortDir?: 1 | -1;
  footer?: React.ReactNode;
  className?: string;
  onRowClick?: (row: T) => void;
}) {
  return (
    <div className={cn("overflow-hidden rounded-2xl border border-border", className)}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface/60 text-left text-[10px] uppercase tracking-wide text-faint">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "px-4 py-2.5 font-medium",
                    col.sortable && onSort && "cursor-pointer select-none hover:text-foreground",
                    col.className,
                  )}
                  onClick={() => col.sortable && onSort?.(col.key)}
                >
                  {col.header}
                  {sortKey === col.key && (
                    <span className="ml-1 tabular-nums text-brand">{sortDir === 1 ? "↑" : "↓"}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr
                key={row.id}
                className={cn(
                  "transition-colors hover:bg-surface/40",
                  onRowClick && "cursor-pointer",
                )}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((col) => (
                  <td key={col.key} className={cn("px-4 py-3 align-middle", col.className)}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {footer && (
        <div className="flex flex-wrap items-center gap-3 border-t border-border bg-surface/40 px-4 py-2 text-[11px] text-faint">
          {footer}
        </div>
      )}
    </div>
  );
}
