import Link from "next/link";
import { pipelineSummary } from "@/lib/career-ops";
import { canonStatus, scoreNum } from "@/lib/format";
import { InsightCards, type InsightItem } from "@/components/agent-ui/insight-cards";

export const dynamic = "force-dynamic";

const STAGES: { key: string; label: string }[] = [
  { key: "EVALUATED", label: "Evaluated" },
  { key: "APPLIED", label: "Applied" },
  { key: "RESPONDED", label: "Responded" },
  { key: "INTERVIEW", label: "Interview" },
  { key: "OFFER", label: "Offer" },
  { key: "HIRED", label: "Hired" },
  { key: "REJECTED", label: "Rejected" },
  { key: "DISCARDED", label: "Discarded" },
];

export default function Analytics() {
  const { applications } = pipelineSummary();
  const total = applications.length;

  const stageCounts = STAGES.map((s) => ({
    ...s,
    n: applications.filter((a) => canonStatus(a.status).includes(s.key)).length,
  }));
  const maxStage = Math.max(1, ...stageCounts.map((s) => s.n));

  const scores = applications.map((a) => scoreNum(a.score)).filter((n) => !Number.isNaN(n));
  const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const buckets = [
    { label: "4.5 – 5.0", test: (n: number) => n >= 4.5 },
    { label: "4.0 – 4.4", test: (n: number) => n >= 4 && n < 4.5 },
    { label: "3.0 – 3.9", test: (n: number) => n >= 3 && n < 4 },
    { label: "< 3.0", test: (n: number) => n < 3 },
  ].map((b) => ({ label: b.label, n: scores.filter(b.test).length }));
  const maxBucket = Math.max(1, ...buckets.map((b) => b.n));

  const companyCounts = new Map<string, number>();
  for (const a of applications) if (a.company) companyCounts.set(a.company, (companyCounts.get(a.company) ?? 0) + 1);
  const topCompanies = [...companyCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const maxCompany = Math.max(1, ...topCompanies.map((c) => c[1]));

  const offers = stageCounts.find((s) => s.key === "OFFER")?.n ?? 0;
  const interviews = stageCounts.find((s) => s.key === "INTERVIEW")?.n ?? 0;
  const applied = stageCounts.find((s) => s.key === "APPLIED")?.n ?? 0;
  const evaluated = stageCounts.find((s) => s.key === "EVALUATED")?.n ?? 0;
  const highFit = scores.filter((n) => n >= 4).length;
  const lowFit = scores.filter((n) => n > 0 && n < 3).length;

  const insights: InsightItem[] = [
    {
      id: "funnel",
      headline:
        total === 0 ? (
          <>No evaluations yet — run a free scan, then score a role to unlock insights.</>
        ) : (
          <>
            You&apos;ve evaluated <span className="text-brand tabular-nums">{total}</span> roles
            {avg ? (
              <>
                {" "}
                at an average of <span className="tabular-nums">{avg.toFixed(2)}</span>/5
              </>
            ) : null}
            .
          </>
        ),
      detail: applied > 0 ? `${applied} marked applied · ${interviews} interviews · ${offers} offers` : "Mark Applied on strong fits to start the demand loop.",
      bars: [
        { label: "Evaluated", value: String(evaluated || total), tone: "flat" },
        { label: "Interviews", value: String(interviews), tone: interviews > 0 ? "up" : "flat" },
        { label: "Offers", value: String(offers), tone: offers > 0 ? "up" : "flat" },
      ],
      ctaLabel: "Open pipeline →",
      onCta: undefined,
    },
    {
      id: "fit",
      headline:
        highFit > 0 ? (
          <>
            <span className="text-brand tabular-nums">{highFit}</span> roles scored ≥ 4.0 — those deserve apply energy first.
          </>
        ) : (
          <>No ≥4.0 fits yet. Keep scanning or tighten title filters.</>
        ),
      detail: lowFit > 0 ? `${lowFit} scored under 3.0 — good candidates to skip.` : "Score distribution will appear as you evaluate.",
      bars: buckets.map((b) => ({
        label: b.label,
        value: String(b.n),
        tone: b.label.startsWith("4.5") || b.label.startsWith("4.0") ? ("up" as const) : b.label.startsWith("<") ? ("down" as const) : ("flat" as const),
      })),
    },
    {
      id: "companies",
      headline:
        topCompanies.length > 0 ? (
          <>
            Most tracked: <span className="font-medium">{topCompanies[0][0]}</span> ({topCompanies[0][1]})
          </>
        ) : (
          <>Company concentration shows up after a few evaluations.</>
        ),
      detail: topCompanies.length > 1 ? `Also watching ${topCompanies.slice(1, 4).map(([n]) => n).join(", ")}` : undefined,
      bars: topCompanies.slice(0, 3).map(([label, n]) => ({ label, value: String(n), tone: "flat" as const })),
    },
  ];

  // Server component: Link-based CTAs instead of onClick
  insights[0].ctaLabel = undefined;

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="font-display text-2xl tracking-tight text-landing">Analytics</h1>
      <p className="mt-1 text-sm text-muted">Across {total} tracked evaluations.</p>

      <div className="mt-6">
        <InsightCards items={insights} />
        <p className="mt-2 text-sm">
          <Link href="/pipeline" className="font-medium text-brand-text hover:underline">
            Open pipeline →
          </Link>
        </p>
      </div>

      <div className="mt-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-faint">Jump to stage</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {STAGES.map((s) => {
            const count = stageCounts.find((c) => c.key === s.key)?.n ?? 0;
            return (
              <Link
                key={s.key}
                href={`/pipeline?tab=${s.key}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface/50 px-3 py-1.5 text-xs font-medium text-muted transition hover:border-brand/40 hover:text-foreground max-sm:min-h-[44px]"
              >
                {s.label}
                <span className="tabular-nums text-faint">{count}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* headline stats */}
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat value={total} label="evaluated" />
        <Stat value={avg ? avg.toFixed(2) : "—"} label="avg score" />
        <Stat
          value={interviews}
          label="interviews"
          hint={interviews === 0 ? "Interviews follow replies — keep follow-ups warm →" : undefined}
        />
        <Stat
          value={offers}
          label="offers"
          hint={offers === 0 ? "Offers follow interviews — keep the conversations going →" : undefined}
        />
      </div>

      <Section title="Pipeline by stage">
        {stageCounts.map((s) => (
          <Bar
            key={s.key}
            label={s.label}
            value={s.n}
            pct={(s.n / maxStage) * 100}
            total={total}
            tone={s.key === "OFFER" ? "positive" : "neutral"}
          />
        ))}
      </Section>

      <Section title="Score distribution">
        {buckets.map((b) => (
          <Bar key={b.label} label={b.label} value={b.n} pct={(b.n / maxBucket) * 100} total={scores.length} />
        ))}
      </Section>

      <Section title="Top companies" id="companies">
        {topCompanies.map(([name, n]) => (
          <Bar key={name} label={name} value={n} pct={(n / maxCompany) * 100} />
        ))}
      </Section>
    </div>
  );
}

function Stat({ value, label, hint }: { value: number | string; label: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface/50 p-4">
      <div className="text-3xl font-semibold tabular-nums">{value}</div>
      <div className="mt-1 text-xs text-faint">{label}</div>
      {hint && (
        <Link href="/" className="mt-2 block text-xs text-muted transition-colors hover:text-brand">
          {hint}
        </Link>
      )}
    </div>
  );
}

function Section({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="mt-10 scroll-mt-8">
      <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">{title}</h2>
      <div className="mt-4 space-y-2.5">{children}</div>
    </section>
  );
}

function Bar({
  label,
  value,
  pct,
  total,
  tone = "neutral",
}: {
  label: string;
  value: number;
  pct: number;
  total?: number;
  tone?: "neutral" | "positive";
}) {
  const share = total && total > 0 ? Math.round((value / total) * 100) : null;
  const fill =
    tone === "positive"
      ? "bg-gradient-to-r from-emerald-500/60 to-emerald-500/30"
      : "bg-gradient-to-r from-foreground/25 to-foreground/10";
  return (
    <div className="flex items-center gap-3">
      <div className="w-32 shrink-0 truncate text-sm text-muted">{label}</div>
      <div className="relative h-7 flex-1 overflow-hidden rounded-md bg-surface">
        <div className={`h-full rounded-md ${fill}`} style={{ width: `${Math.max(pct, value > 0 ? 4 : 0)}%` }} />
      </div>
      <div className="w-20 shrink-0 text-right text-sm tabular-nums">
        {value}
        {share !== null && <span className="ml-1 text-xs text-faint">{share}%</span>}
      </div>
    </div>
  );
}
