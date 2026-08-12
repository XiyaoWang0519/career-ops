import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

type WithChildren = { children?: ReactNode };

function textOf(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement<WithChildren>(node)) return textOf(node.props.children);
  return "";
}

function childElements(node: ReactNode): ReactElement<WithChildren>[] {
  return Children.toArray(node).filter(isValidElement) as ReactElement<WithChildren>[];
}

function findChildByTag(node: ReactNode, tag: string): ReactElement<WithChildren> | undefined {
  const want = tag.toLowerCase();
  for (const el of childElements(node)) {
    const type = el.type;
    const name = typeof type === "string" ? type.toLowerCase() : "";
    if (name === want) return el;
    const nested = findChildByTag(el.props.children, tag);
    if (nested) return nested;
  }
  return undefined;
}

function rowCells(row: ReactElement<WithChildren>): ReactNode[] {
  const cells = childElements(row.props.children).filter((el) => {
    const t = el.type;
    return typeof t === "string" && (t === "th" || t === "td");
  });
  return cells.map((c) => c.props.children);
}

function normalizeHeader(h: string): string {
  return h.replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
}

/** STAR+R interview-plan tables (and localized variants) — too wide for a 3xl column. */
function isStarStoryTable(headers: string[]): boolean {
  const trimmed = headers.map(normalizeHeader);
  const lower = trimmed.map((h) => h.toLowerCase());
  const hasLetterCols =
    trimmed.some((h) => /^s$/i.test(h)) &&
    trimmed.some((h) => /^t$/i.test(h)) &&
    trimmed.some((h) => /^a$/i.test(h)) &&
    trimmed.some((h) => /^r$/i.test(h));
  const hasStarLabel = lower.some((h) => h.includes("star"));
  const hasReflection = lower.some((h) =>
    /reflect|réflex|reflex|rifless|yansıma|рефлекс|反思/.test(h),
  );
  return hasLetterCols || (hasStarLabel && (hasReflection || trimmed.length >= 6));
}

type ColKey = "num" | "requirement" | "story" | "s" | "t" | "a" | "r" | "reflection" | "other";

function classifyHeader(h: string): ColKey {
  const t = normalizeHeader(h);
  const lower = t.toLowerCase();
  if (/^#$/.test(t) || /^no\.?$/i.test(t)) return "num";
  if (/^s$/i.test(t) || /^situation$/i.test(lower) || /^situaci/i.test(lower)) return "s";
  if (/^t$/i.test(t) || /^task$/i.test(lower) || /^tâche$/i.test(lower) || /^tarea$/i.test(lower)) return "t";
  if (/^a$/i.test(t) || /^action$/i.test(lower) || /^acción$/i.test(lower) || /^azione$/i.test(lower)) return "a";
  if (/^r$/i.test(t) || /^result$/i.test(lower) || /^resultado$/i.test(lower) || /^résultat$/i.test(lower)) return "r";
  if (/reflect|réflex|reflex|rifless|yansıma|рефлекс|反思/.test(lower)) return "reflection";
  if (/star/.test(lower) || /story|historia|histoire|storia|hikaye|історі/.test(lower)) return "story";
  if (/requirement|requisito|prerequis|anforderung|требования|wymaganie|gereksinim|资格|要件|자격/.test(lower) || /jd\b/.test(lower) || /offer|annonce|vacature|lowongan|ops\.?lag/.test(lower)) {
    return "requirement";
  }
  return "other";
}

const STAR_LABELS: Record<"s" | "t" | "a" | "r", string> = {
  s: "Situation",
  t: "Task",
  a: "Action",
  r: "Result",
};

function StarStoryCards({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  const keys = headers.map(classifyHeader);

  const pick = (cells: ReactNode[], key: ColKey): ReactNode => {
    const i = keys.indexOf(key);
    return i >= 0 ? cells[i] : null;
  };

  return (
    <div className="report-star-stories my-4 space-y-3" role="list" aria-label="STAR+R stories">
      {rows.map((cells, i) => {
        const num = textOf(pick(cells, "num")).trim() || String(i + 1);
        const requirement = pick(cells, "requirement");
        const story = pick(cells, "story");
        const reflection = pick(cells, "reflection");
        const star = (["s", "t", "a", "r"] as const).map((k) => ({
          key: k,
          label: STAR_LABELS[k],
          body: pick(cells, k),
        }));

        return (
          <article
            key={i}
            role="listitem"
            className="rounded-xl border border-border/80 bg-background/60 px-4 py-3.5"
          >
            <header className="flex items-baseline gap-2.5">
              <span className="font-mono text-[11px] tabular-nums text-faint">{num}</span>
              <div className="min-w-0">
                {requirement && (
                  <div className="text-[15px] font-semibold leading-snug text-foreground">
                    {requirement}
                  </div>
                )}
                {story && (
                  <div className="mt-0.5 text-sm leading-snug text-muted">{story}</div>
                )}
              </div>
            </header>

            <dl className="mt-3 grid gap-2.5 sm:grid-cols-2">
              {star.map(({ key, label, body }) =>
                body ? (
                  <div key={key} className="min-w-0 rounded-lg bg-surface/50 px-3 py-2">
                    <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-brand/80">
                      {key} · {label}
                    </dt>
                    <dd className="mt-1 text-sm leading-relaxed text-foreground/90">{body}</dd>
                  </div>
                ) : null,
              )}
            </dl>

            {reflection && (
              <div className="mt-3 border-t border-border/70 pt-2.5">
                <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">Reflection</div>
                <div className="mt-1 text-sm leading-relaxed text-muted">{reflection}</div>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

function ReportTable({ children }: { children?: ReactNode }) {
  const thead = findChildByTag(children, "thead");
  const tbody = findChildByTag(children, "tbody");
  const headerRow = thead ? childElements(thead.props.children)[0] : undefined;
  const headers = headerRow ? rowCells(headerRow).map((c) => textOf(c)) : [];

  if (headers.length && isStarStoryTable(headers) && tbody) {
    const rows = childElements(tbody.props.children).map(rowCells);
    if (rows.length) return <StarStoryCards headers={headers} rows={rows} />;
  }

  // 2-col Field/Assessment tables stay fluid; 3+ cols get horizontal scroll room.
  const wide = headers.length >= 3;
  return (
    <div className="report-table-scroll" data-cols={wide ? "wide" : "normal"}>
      <table>{children}</table>
    </div>
  );
}

const components: Components = {
  table: ({ children }) => <ReportTable>{children}</ReportTable>,
};

export function ReportMarkdown({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {children}
    </ReactMarkdown>
  );
}
