"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  BriefcaseBusiness,
  Check,
  ChevronRight,
  CircleAlert,
  Compass,
  FileText,
  Loader2,
  Radar,
  RefreshCw,
  Save,
  Search,
  Settings,
  Sparkles,
  UserRound,
} from "lucide-react";
import { useExplore } from "@/components/explore/explore-provider";
import { useJobs } from "@/components/jobs/job-store";
import { usePipeline } from "@/components/pipeline/pipeline-provider";
import { cn } from "@/lib/cn";
import { ATS_LABEL } from "@/lib/explore";
import { scoreNum } from "@/lib/format";
import type { CadenceEntry, CadenceMetadata } from "@/lib/followups";
import { sourceScanProgress } from "@/lib/scan-progress.mjs";

type WidgetAction = (id: string, args: Record<string, unknown>) => void;

type WidgetShellProps = {
  icon: typeof Compass;
  title: string;
  eyebrow?: string;
  children: ReactNode;
  footer?: ReactNode;
};

function Signal({ level = 3 }: { level?: number }) {
  return (
    <span className="flex items-end gap-0.5" aria-hidden="true">
      {[0, 1, 2].map((bar) => (
        <span
          key={bar}
          className={cn("w-1 rounded-full", bar < level ? "bg-emerald-500" : "bg-border")}
          style={{ height: 6 + bar * 2 }}
        />
      ))}
    </span>
  );
}

function WidgetShell({ icon: Icon, title, eyebrow = "Assistant action", children, footer }: WidgetShellProps) {
  return (
    <section className="w-full max-w-[34rem] overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_1px_2px_rgba(16,24,40,.06),0_12px_32px_rgba(16,24,40,.05)]">
      <header className="flex items-center gap-2.5 px-3.5 pb-2.5 pt-3.5">
        <span className="grid size-7 place-items-center rounded-lg bg-brand-soft text-brand-text">
          <Icon className="size-3.5" />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">{eyebrow}</p>
          <h3 className="truncate text-[13px] font-semibold text-foreground">{title}</h3>
        </div>
      </header>
      <div className="border-t border-border px-3.5 py-3">{children}</div>
      {footer && <footer className="flex min-h-11 items-center justify-between gap-3 border-t border-border bg-background/55 px-3.5 py-2">{footer}</footer>}
    </section>
  );
}

function CompactButton({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-7 items-center justify-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 text-[12px] font-medium text-foreground shadow-sm transition-[background-color,transform] hover:bg-surface-hover active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45",
        className,
      )}
      {...props}
    />
  );
}

function PrimaryButton({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <CompactButton className={cn("border-brand bg-brand text-brand-foreground hover:bg-brand-200", className)} {...props} />;
}

function splitInput(value: string): string[] {
  return value.split(/[,\n]/).map((item) => item.trim()).filter(Boolean);
}

function pathParts(path: string) {
  try {
    const parsed = new URL(path, "http://career-ops.local");
    return { route: parsed.pathname, params: parsed.searchParams };
  } catch {
    return { route: "/", params: new URLSearchParams() };
  }
}

function safeActionPath(path: string): string {
  if (!path.startsWith("/") || path.startsWith("//")) return "/";
  const { route } = pathParts(path);
  const allowed = route === "/" || /^\/(explore|pipeline|followups|portals|analytics|cv|config|apply|jobs)(\/[^/]+)?$/.test(route);
  return allowed ? path : "/";
}

function ExploreWidget({ path, onAction }: { path: string; onAction: WidgetAction }) {
  const explore = useExplore();
  const { params } = pathParts(path);
  const [roles, setRoles] = useState(() => params.get("q")?.split(",").join(", ") || explore.filters.positive.join(", "));
  const [locations, setLocations] = useState(() => params.get("loc")?.split(",").join(", ") || explore.filters.allow.join(", "));
  const [since, setSince] = useState(() => Number(params.get("since")) || explore.filters.sinceDays);
  const visible = explore.offers.slice(0, 3);
  const progress = useMemo(
    () => sourceScanProgress(explore.filters.ats, explore.sources),
    [explore.filters.ats, explore.sources],
  );
  const activeLabel = progress.activeSource
    ? ATS_LABEL[progress.activeSource as keyof typeof ATS_LABEL] ?? progress.activeSource
    : "ATS network";

  const run = () => {
    explore.applyPatch({ positive: splitInput(roles), allow: splitInput(locations), since }, { run: true });
  };

  return (
    <WidgetShell
      icon={Compass}
      title={explore.running ? "Scanning live ATS sources" : explore.phase === "results" ? `${explore.matchCount} fresh matches` : "Find matching roles"}
      footer={
        <>
          <span className="flex items-center gap-2 text-[11px] text-muted">
            {explore.running ? <Loader2 className="size-3 animate-spin text-brand" /> : <Signal level={explore.phase === "results" ? 3 : 2} />}
            {explore.running ? (explore.matchCount ? `${explore.matchCount.toLocaleString()} matches found` : "No matches yet") : "Free · no tokens"}
          </span>
          <PrimaryButton onClick={run} disabled={explore.running || !roles.trim()}>
            {explore.running ? "Scanning" : explore.phase === "results" ? "Scan again" : "Run scan"}
          </PrimaryButton>
        </>
      }
    >
      {explore.phase === "results" && visible.length ? (
        <div className="space-y-1.5">
          {visible.map((offer) => {
            const saved = explore.added.has(offer.url);
            const saving = explore.adding.has(offer.url);
            return (
              <div key={offer.url} className="flex items-center gap-2 rounded-xl border border-border bg-background/50 px-2.5 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-medium text-foreground">{offer.title}</p>
                  <p className="truncate text-[11px] text-faint">{offer.company} · {offer.location || offer.ats}</p>
                </div>
                <CompactButton disabled={saved || saving} onClick={() => void explore.addToPipeline([offer])} aria-label={`Save ${offer.title}`}>
                  {saving ? <Loader2 className="size-3 animate-spin" /> : saved ? <Check className="size-3" /> : <Save className="size-3" />}
                  {saved ? "Saved" : "Save"}
                </CompactButton>
                <CompactButton onClick={() => onAction("evaluate", { url: offer.url, title: `Evaluate · ${offer.company}`, subtitle: offer.title })}>
                  Evaluate
                </CompactButton>
              </div>
            );
          })}
          {explore.offers.length > visible.length && <p className="px-1 pt-1 text-[11px] text-faint">+{explore.offers.length - visible.length} more matches available</p>}
        </div>
      ) : explore.running ? (
        <div className="space-y-2.5 py-2" aria-live="polite">
          <div
            className="h-2 overflow-hidden rounded-full bg-surface-hover"
            role="progressbar"
            aria-label="ATS scan progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress.percent}
            aria-valuetext={`${progress.percent}% overall`}
          >
            <div
              className="h-full rounded-full bg-brand transition-[width] duration-300 ease-out"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[12px] font-medium text-foreground">
                {progress.total > 0
                  ? `${activeLabel} · ${progress.done.toLocaleString()} of ${progress.total.toLocaleString()} companies`
                  : `Preparing ${activeLabel}…`}
              </p>
              <p className="mt-0.5 text-[11px] text-faint">Source {progress.sourceNumber} of {progress.sourceCount}</p>
            </div>
            <span className="shrink-0 text-[12px] tabular-nums text-muted">{progress.percent}%</span>
          </div>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_5rem]">
          <label className="text-[11px] font-medium text-muted">
            Roles
            <input value={roles} onChange={(event) => setRoles(event.target.value)} placeholder="AI infrastructure, ML" className="mt-1 h-8 w-full rounded-lg border border-border bg-background px-2.5 text-[12px] text-foreground outline-none focus:border-brand/60" />
          </label>
          <label className="text-[11px] font-medium text-muted">
            Location
            <input value={locations} onChange={(event) => setLocations(event.target.value)} placeholder="Toronto, Remote" className="mt-1 h-8 w-full rounded-lg border border-border bg-background px-2.5 text-[12px] text-foreground outline-none focus:border-brand/60" />
          </label>
          <label className="text-[11px] font-medium text-muted">
            Posted
            <select value={since} onChange={(event) => setSince(Number(event.target.value))} className="mt-1 h-8 w-full rounded-lg border border-border bg-background px-2 text-[12px] text-foreground outline-none focus:border-brand/60">
              <option value={7}>7d</option><option value={14}>14d</option><option value={30}>30d</option><option value={60}>60d</option>
            </select>
          </label>
        </div>
      )}
    </WidgetShell>
  );
}

function PipelineWidget({ path, onAction, onPrompt }: { path: string; onAction: WidgetAction; onPrompt: (prompt: string) => void }) {
  const pipeline = usePipeline();
  const { params } = pathParts(path);
  const initialTab = (params.get("tab") || "ACTIVE").toUpperCase();
  const [tab, setTab] = useState(initialTab);
  const [query, setQuery] = useState(params.get("q") || "");
  const min = Number(params.get("min") || 0);
  const activeStatuses = new Set(["Applied", "Responded", "Interview", "Offer"]);
  const applications = pipeline.applications.filter((application) => {
    const tabMatch = tab === "ALL" || (tab === "ACTIVE" ? activeStatuses.has(application.status) : application.status.toUpperCase() === tab);
    return tabMatch && scoreNum(application.score) >= min && `${application.company} ${application.role}`.toLowerCase().includes(query.toLowerCase());
  });
  const inbox = pipeline.inbox.filter((job) => !job.done && `${job.company} ${job.role}`.toLowerCase().includes(query.toLowerCase()));
  const count = tab === "INBOX" ? inbox.length : applications.length;

  return (
    <WidgetShell
      icon={BriefcaseBusiness}
      title={`${count} ${tab === "INBOX" ? "roles to review" : "opportunities"}`}
      footer={
        <>
          <span className="flex items-center gap-2 text-[11px] text-muted"><Signal level={count ? 3 : 1} /> Live pipeline</span>
          <CompactButton onClick={() => onPrompt("Review this pipeline view and tell me the single highest-leverage next action.")}><Sparkles className="size-3" /> Ask what next</CompactButton>
        </>
      }
    >
      <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
        {["ACTIVE", "INBOX", "ALL"].map((value) => (
          <button key={value} type="button" aria-pressed={tab === value} onClick={() => setTab(value)} className={cn("h-7 rounded-lg px-2.5 text-[11px] font-medium transition-colors", tab === value ? "bg-brand-soft text-brand-text" : "text-muted hover:bg-surface-hover")}>{value[0] + value.slice(1).toLowerCase()}</button>
        ))}
        <label className="relative ml-auto min-w-[9rem] flex-1 sm:max-w-[12rem]">
          <Search className="pointer-events-none absolute left-2 top-2 size-3 text-faint" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter" aria-label="Filter opportunities" className="h-7 w-full rounded-lg border border-border bg-background pl-7 pr-2 text-[11px] text-foreground outline-none focus:border-brand/60" />
        </label>
      </div>
      <div className="space-y-1.5">
        {tab === "INBOX" ? inbox.slice(0, 4).map((job) => (
          <div key={job.url} className="flex items-center gap-2 rounded-xl border border-border bg-background/45 px-2.5 py-2">
            <div className="min-w-0 flex-1"><p className="truncate text-[12.5px] font-medium">{job.role}</p><p className="truncate text-[11px] text-faint">{job.company}{job.location ? ` · ${job.location}` : ""}</p></div>
            <CompactButton onClick={() => onAction("evaluate", { url: job.url, title: `Evaluate · ${job.company}`, subtitle: job.role })}>Evaluate</CompactButton>
          </div>
        )) : applications.slice(0, 4).map((application) => (
          <button key={application.n} type="button" onClick={() => onAction("navigate", { path: `/pipeline/${application.n}` })} className="flex w-full items-center gap-2 rounded-xl border border-border bg-background/45 px-2.5 py-2 text-left transition-colors hover:bg-surface-hover">
            <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-surface-hover text-[11px] font-semibold text-muted">{application.n}</span>
            <span className="min-w-0 flex-1"><span className="block truncate text-[12.5px] font-medium">{application.company} · {application.role}</span><span className="block truncate text-[11px] text-faint">{application.status} · {application.score || "Not scored"}</span></span>
            <ChevronRight className="size-3.5 text-faint" />
          </button>
        ))}
        {count === 0 && <p className="rounded-xl border border-dashed border-border px-3 py-5 text-center text-[12px] text-faint">Nothing matches this view.</p>}
      </div>
    </WidgetShell>
  );
}

const STATUS_OPTIONS = ["Evaluated", "Applied", "Responded", "Interview", "Offer", "Hired", "Rejected", "Discarded", "SKIP"];

function ReportWidget({ n, onAction, onPrompt }: { n: string; onAction: WidgetAction; onPrompt: (prompt: string) => void }) {
  const { applications } = usePipeline();
  const application = applications.find((item) => item.n === n);
  const [status, setStatus] = useState(application?.status || "Evaluated");
  if (!application) return <FallbackWidget path={`/pipeline/${n}`} onPrompt={onPrompt} />;
  const score = scoreNum(application.score);
  return (
    <WidgetShell
      icon={FileText}
      title={`${application.company} · ${application.role}`}
      eyebrow={`Evaluation #${application.n}`}
      footer={
        <>
          <span className="flex items-center gap-2 text-[11px] text-muted"><Signal level={score >= 4.5 ? 3 : score >= 3.5 ? 2 : 1} /> {application.score || "Unscored"}</span>
          <div className="flex gap-1.5"><CompactButton onClick={() => onPrompt(`Review application #${application.n} and tell me whether it is worth pursuing now.`)}>Ask assistant</CompactButton><PrimaryButton onClick={() => onAction("generatePdf", { n: application.n })}>Generate CV</PrimaryButton></div>
        </>
      }
    >
      <p className="mb-3 line-clamp-2 text-[12px] leading-relaxed text-muted">{application.notes || "Review the evaluation, decide the next stage, or generate a tailored CV."}</p>
      <div className="flex items-end gap-2">
        <label className="min-w-0 flex-1 text-[11px] font-medium text-muted">Status
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="mt-1 h-8 w-full rounded-lg border border-border bg-background px-2.5 text-[12px] text-foreground outline-none focus:border-brand/60">
            {STATUS_OPTIONS.map((value) => <option key={value}>{value}</option>)}
          </select>
        </label>
        <CompactButton disabled={status === application.status} onClick={() => onAction("setStatus", { n: application.n, status })}>Update</CompactButton>
      </div>
    </WidgetShell>
  );
}

type FollowupResponse = { available: boolean; metadata: CadenceMetadata | null; entries: CadenceEntry[] };

function FollowupsWidget({ onPrompt }: { onPrompt: (prompt: string) => void }) {
  const [data, setData] = useState<FollowupResponse | null>(null);
  const load = () => {
    setData(null);
    void fetch("/api/followups?full=1").then((response) => response.json()).then((value: FollowupResponse) => setData(value)).catch(() => setData({ available: false, metadata: null, entries: [] }));
  };
  useEffect(load, []);
  const entries = data?.entries?.slice(0, 4) || [];
  return (
    <WidgetShell
      icon={Activity}
      title={data ? `${data.metadata?.overdue || 0} follow-ups overdue` : "Checking follow-ups"}
      footer={<><span className="text-[11px] text-muted">{data?.metadata?.actionable || 0} actionable</span><div className="flex gap-1.5"><CompactButton onClick={load}><RefreshCw className="size-3" /> Refresh</CompactButton><PrimaryButton onClick={() => onPrompt("Draft the most important follow-up due today, but do not send it.")}>Draft next</PrimaryButton></div></>}
    >
      {!data ? <div className="flex items-center gap-2 py-5 text-[12px] text-muted"><Loader2 className="size-3.5 animate-spin text-brand" /> Reading the cadence…</div> : entries.length ? (
        <div className="space-y-1.5">{entries.map((entry) => (
          <button key={entry.num} type="button" onClick={() => onPrompt(`Draft a follow-up for application #${entry.num}, ${entry.company} · ${entry.role}. Do not send it.`)} className="flex w-full items-center gap-2 rounded-xl border border-border bg-background/45 px-2.5 py-2 text-left hover:bg-surface-hover">
            <span className={cn("size-2 rounded-full", /urgent/i.test(entry.urgency) ? "bg-red-500" : /overdue/i.test(entry.urgency) ? "bg-amber-500" : "bg-blue-500")} />
            <span className="min-w-0 flex-1"><span className="block truncate text-[12.5px] font-medium">{entry.company} · {entry.role}</span><span className="block text-[11px] text-faint">{entry.daysUntilNext == null ? entry.urgency : entry.daysUntilNext < 0 ? `${-entry.daysUntilNext}d overdue` : `due in ${entry.daysUntilNext}d`}</span></span>
            <ChevronRight className="size-3.5 text-faint" />
          </button>
        ))}</div>
      ) : <p className="py-5 text-center text-[12px] text-faint">No follow-ups need attention.</p>}
    </WidgetShell>
  );
}

function InsightsWidget({ onPrompt }: { onPrompt: (prompt: string) => void }) {
  const { applications } = usePipeline();
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of applications) counts[item.status] = (counts[item.status] || 0) + 1;
    return counts;
  }, [applications]);
  const strong = applications.filter((item) => scoreNum(item.score) >= 4.5).length;
  const progressed = (statusCounts.Interview || 0) + (statusCounts.Offer || 0) + (statusCounts.Hired || 0);
  const metrics = [{ label: "Tracked", value: applications.length }, { label: "Strong fit", value: strong }, { label: "Advanced", value: progressed }];
  return (
    <WidgetShell icon={BarChart3} title="Search health snapshot" footer={<><span className="flex items-center gap-2 text-[11px] text-muted"><Signal level={applications.length ? 3 : 1} /> Based on your tracker</span><PrimaryButton onClick={() => onPrompt("Analyze my current job-search funnel and identify the biggest bottleneck.")}>Analyze bottleneck</PrimaryButton></>}>
      <div className="grid grid-cols-3 gap-2">{metrics.map((metric) => <div key={metric.label} className="rounded-xl border border-border bg-background/50 px-3 py-2.5"><p className="text-xl font-semibold tabular-nums text-foreground">{metric.value}</p><p className="text-[10px] uppercase tracking-wide text-faint">{metric.label}</p></div>)}</div>
    </WidgetShell>
  );
}

function CvWidget({ onPrompt }: { onPrompt: (prompt: string) => void }) {
  const [content, setContent] = useState("");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  useEffect(() => { void fetch("/api/cv").then((response) => response.json()).then((value) => setContent(typeof value.content === "string" ? value.content : "")).finally(() => setLoading(false)); }, []);
  const save = async () => {
    setSaving(true); setSaved(false);
    const response = await fetch("/api/cv", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }) });
    setSaving(false); setSaved(response.ok);
  };
  return (
    <WidgetShell icon={UserRound} title="Career profile source" footer={<><span className="text-[11px] text-muted">{saved ? "Saved with backup" : `${content.split(/\s+/).filter(Boolean).length} words`}</span><div className="flex gap-1.5"><CompactButton onClick={() => onPrompt("Review my CV and recommend the highest-impact improvement without inventing any facts.")}>Review</CompactButton><PrimaryButton onClick={() => void save()} disabled={loading || saving}>{saving ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />} Save</PrimaryButton></div></>}>
      {loading ? <div className="flex items-center gap-2 py-8 text-[12px] text-muted"><Loader2 className="size-3.5 animate-spin text-brand" /> Loading CV…</div> : <textarea value={content} onChange={(event) => { setContent(event.target.value); setSaved(false); }} aria-label="CV markdown" className="h-40 w-full resize-y rounded-xl border border-border bg-background px-3 py-2 font-mono text-[11px] leading-relaxed text-foreground outline-none focus:border-brand/60" />}
    </WidgetShell>
  );
}

function SourcesWidget({ onAction }: { onAction: WidgetAction }) {
  const explore = useExplore();
  const [roles, setRoles] = useState(explore.filters.positive.join(", "));
  const [locations, setLocations] = useState(explore.filters.allow.join(", "));
  return (
    <WidgetShell icon={Radar} title="Scanner targets" footer={<><span className="text-[11px] text-muted">Greenhouse · Lever · Ashby · Workday</span><PrimaryButton disabled={!roles.trim()} onClick={() => onAction("setPortals", { roles: splitInput(roles), location: splitInput(locations) })}>Review update</PrimaryButton></>}>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-[11px] font-medium text-muted">Target roles<input value={roles} onChange={(event) => setRoles(event.target.value)} className="mt-1 h-8 w-full rounded-lg border border-border bg-background px-2.5 text-[12px] text-foreground outline-none focus:border-brand/60" /></label>
        <label className="text-[11px] font-medium text-muted">Locations<input value={locations} onChange={(event) => setLocations(event.target.value)} className="mt-1 h-8 w-full rounded-lg border border-border bg-background px-2.5 text-[12px] text-foreground outline-none focus:border-brand/60" /></label>
      </div>
    </WidgetShell>
  );
}

function SettingsWidget({ onPrompt }: { onPrompt: (prompt: string) => void }) {
  const [connected, setConnected] = useState<boolean | null>(null);
  useEffect(() => { void fetch("/api/runtime").then((response) => response.json()).then((value) => { let local = false; try { local = Boolean(JSON.parse(localStorage.getItem("career-ops:config") || "{}").cliId); } catch {} setConnected(Boolean(value.defaultCli) || local); }).catch(() => setConnected(false)); }, []);
  return (
    <WidgetShell icon={Settings} title="Assistant connection" footer={<><span className="flex items-center gap-2 text-[11px] text-muted"><span className={cn("size-2 rounded-full", connected ? "bg-emerald-500" : "bg-amber-500")} />{connected == null ? "Checking" : connected ? "AI tool connected" : "Needs setup"}</span><CompactButton onClick={() => onPrompt(connected ? "Check whether my career-ops setup is healthy." : "Help me connect an AI tool to career-ops.")}>{connected ? "Run health check" : "Guide me"}</CompactButton></>}>
      <p className="text-[12px] leading-relaxed text-muted">{connected ? "The Assistant can run evaluations, research, CV generation, and other agent actions from this conversation." : "Connect one local AI tool to unlock evaluations and research. Free deterministic scans remain available."}</p>
    </WidgetShell>
  );
}

function TodayWidget({ onAction, onPrompt }: { onAction: WidgetAction; onPrompt: (prompt: string) => void }) {
  const { inbox, applications } = usePipeline();
  const pending = inbox.filter((item) => !item.done).length;
  const active = applications.filter((item) => ["Applied", "Responded", "Interview", "Offer"].includes(item.status)).length;
  return (
    <WidgetShell icon={Sparkles} title="Today’s search command center" footer={<><span className="flex items-center gap-2 text-[11px] text-muted"><Signal level={pending || active ? 3 : 1} /> Live priorities</span><PrimaryButton onClick={() => onPrompt("Give me the three highest-leverage actions for my job search today.")}>Plan my day</PrimaryButton></>}>
      <div className="space-y-1.5">
        <button type="button" onClick={() => onAction("filterPipeline", { tab: "INBOX" })} className="flex w-full items-center rounded-xl border border-border bg-background/45 px-3 py-2 text-left hover:bg-surface-hover"><span className="text-[12.5px] font-medium">Review new roles</span><span className="ml-auto text-[11px] text-faint">{pending} waiting</span><ChevronRight className="ml-2 size-3.5 text-faint" /></button>
        <button type="button" onClick={() => onAction("filterPipeline", { tab: "ACTIVE" })} className="flex w-full items-center rounded-xl border border-border bg-background/45 px-3 py-2 text-left hover:bg-surface-hover"><span className="text-[12.5px] font-medium">Move active applications</span><span className="ml-auto text-[11px] text-faint">{active} active</span><ChevronRight className="ml-2 size-3.5 text-faint" /></button>
      </div>
    </WidgetShell>
  );
}

function JobWidget({ id }: { id: string }) {
  const { jobs } = useJobs();
  const job = jobs.find((item) => item.id === id);
  return (
    <WidgetShell icon={Activity} title={job?.title || "Agent task"} eyebrow="Live task" footer={<><span className="flex items-center gap-2 text-[11px] text-muted">{job?.status === "running" ? <Loader2 className="size-3 animate-spin text-brand" /> : job?.status === "error" ? <CircleAlert className="size-3 text-red-500" /> : <Check className="size-3 text-emerald-500" />}{job?.status || "Completed earlier"}</span>{job && <Link href={`/jobs/${id}`} className="inline-flex h-7 items-center gap-1 rounded-lg border border-border bg-surface px-2.5 text-[12px] font-medium hover:bg-surface-hover">View output <ArrowUpRight className="size-3" /></Link>}</>}>
      <p className="text-[12px] leading-relaxed text-muted">{job?.subtitle || "This task’s compact status stays in the conversation while the agent works."}</p>
    </WidgetShell>
  );
}

function FallbackWidget({ path, onPrompt }: { path: string; onPrompt: (prompt: string) => void }) {
  return (
    <WidgetShell icon={BriefcaseBusiness} title="Career workspace" footer={<><span className="text-[11px] text-muted">Agent-native action</span><div className="flex gap-1.5"><CompactButton onClick={() => onPrompt(`Help me complete the next action for ${path} inside this chat.`)}>Continue here</CompactButton><Link href={path} className="inline-flex h-7 items-center gap-1 rounded-lg border border-border bg-surface px-2.5 text-[12px] font-medium hover:bg-surface-hover">Full view <ArrowUpRight className="size-3" /></Link></div></>}>
      <p className="text-[12px] leading-relaxed text-muted">The Assistant can guide and execute the next step here. Open the full view only when you need the complete workspace.</p>
    </WidgetShell>
  );
}

export function AssistantActionWidget({ path, onAction, onPrompt }: { path: string; onAction: WidgetAction; onPrompt: (prompt: string) => void }) {
  const target = safeActionPath(path);
  const { route } = pathParts(target);
  if (route === "/") return <TodayWidget onAction={onAction} onPrompt={onPrompt} />;
  if (route === "/explore") return <ExploreWidget path={target} onAction={onAction} />;
  if (route === "/pipeline") return <PipelineWidget path={target} onAction={onAction} onPrompt={onPrompt} />;
  if (route.startsWith("/pipeline/")) return <ReportWidget n={route.split("/")[2]} onAction={onAction} onPrompt={onPrompt} />;
  if (route === "/followups") return <FollowupsWidget onPrompt={onPrompt} />;
  if (route === "/analytics") return <InsightsWidget onPrompt={onPrompt} />;
  if (route === "/cv") return <CvWidget onPrompt={onPrompt} />;
  if (route === "/portals") return <SourcesWidget onAction={onAction} />;
  if (route === "/config") return <SettingsWidget onPrompt={onPrompt} />;
  if (route.startsWith("/jobs/")) return <JobWidget id={route.split("/")[2]} />;
  return <FallbackWidget path={target} onPrompt={onPrompt} />;
}
