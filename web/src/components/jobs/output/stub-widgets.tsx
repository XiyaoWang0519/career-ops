/** Lightweight placeholders for future Activity kinds (registry-ready). */

export function DocumentDraftWidget({
  title,
  markdown,
  pdfHref,
}: {
  title: string;
  markdown: string;
  pdfHref?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface/40 px-5 py-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">Document</p>
      <p className="mt-1 font-display text-lg tracking-tight text-landing">{title}</p>
      {pdfHref ? (
        <a href={pdfHref} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-brand">
          Open PDF
        </a>
      ) : null}
      <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap text-sm text-muted">{markdown}</pre>
    </div>
  );
}

export function PrepDocWidget({ title, path, markdown }: { title: string; path: string; markdown?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface/40 px-5 py-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">Prep</p>
      <p className="mt-1 font-display text-lg tracking-tight text-landing">{title}</p>
      <p className="text-xs text-faint">{path}</p>
      {markdown ? <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap text-sm text-muted">{markdown}</pre> : null}
    </div>
  );
}

export function ListResultWidget({ label, count, samples }: { label: string; count: number; samples?: string[] }) {
  return (
    <div className="rounded-2xl border border-border bg-surface/40 px-5 py-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">{label}</p>
      <p className="mt-1 font-display text-2xl tracking-tight text-landing tabular-nums">{count}</p>
      {samples?.length ? (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted">
          {samples.slice(0, 8).map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function TrackerDeltaWidget({
  reportNum,
  status,
  previousStatus,
  archivePath,
}: {
  reportNum: string;
  status: string;
  previousStatus?: string;
  archivePath?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface/40 px-5 py-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">Tracker</p>
      <p className="mt-1 text-sm text-landing">
        #{reportNum}: {previousStatus ? `${previousStatus} → ` : ""}
        <span className="font-medium">{status}</span>
      </p>
      {archivePath ? <p className="mt-1 text-xs text-faint">{archivePath}</p> : null}
    </div>
  );
}

export function MessageDraftWidget({ subject, body }: { subject?: string; body: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface/40 px-5 py-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">Draft</p>
      {subject ? <p className="mt-1 font-medium text-landing">{subject}</p> : null}
      <pre className="mt-2 whitespace-pre-wrap text-sm text-muted">{body}</pre>
    </div>
  );
}

export function AnalysisReportWidget({ title, path, summary }: { title: string; path?: string; summary?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface/40 px-5 py-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">Analysis</p>
      <p className="mt-1 font-display text-lg tracking-tight text-landing">{title}</p>
      {path ? <p className="text-xs text-faint">{path}</p> : null}
      {summary ? <p className="mt-2 text-sm text-muted">{summary}</p> : null}
    </div>
  );
}
