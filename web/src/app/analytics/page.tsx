import Link from "next/link";
import { pipelineSummary } from "@/lib/career-ops";
import { canonStatus, scoreNum } from "@/lib/format";
import { InsightsActions } from "@/components/insights-actions";

export const dynamic = "force-dynamic";

const STAGES: { key: string; label: string }[] = [
  { key: "EVALUATED", label: "Evaluated" },
  { key: "PURSUING", label: "Pursuing" },
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
    { label: "4.5 – 5.0", min: 4.5, max: 5, test: (n: number) => n >= 4.5 },
    { label: "4.0 – 4.4", min: 4, max: 4.49, test: (n: number) => n >= 4 && n < 4.5 },
    { label: "3.0 – 3.9", min: 3, max: 3.99, test: (n: number) => n >= 3 && n < 4 },
    { label: "< 3.0", min: 0, max: 2.99, test: (n: number) => n < 3 },
  ].map((b) => ({ ...b, n: scores.filter(b.test).length }));
  const maxBucket = Math.max(1, ...buckets.map((b) => b.n));

  const companyCounts = new Map<string, number>();
  for (const a of applications) if (a.company) companyCounts.set(a.company, (companyCounts.get(a.company) ?? 0) + 1);
  const topCompanies = [...companyCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const maxCompany = Math.max(1, ...topCompanies.map((c) => c[1]));

  const offers = stageCounts.find((s) => s.key === "OFFER")?.n ?? 0;
  const interviews = stageCounts.find((s) => s.key === "INTERVIEW")?.n ?? 0;

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="font-display text-2xl tracking-tight text-landing">Insights</h1>
      <p className="mt-1 text-sm text-muted">Understand the funnel, then jump straight to the opportunities behind each signal.</p>

      {/* headline stats */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat value={total} label="opportunities" href="/pipeline?tab=ALL" />
        <Stat value={avg ? avg.toFixed(2) : "—"} label="avg score" href="/pipeline?tab=ALL&sort=score" />
        <Stat
          value={interviews}
          label="interviews"
          href="/pipeline?tab=INTERVIEW"
          hint={interviews === 0 ? "Interviews follow replies — keep follow-ups warm →" : undefined}
        />
        <Stat
          value={offers}
          label="offers"
          href="/pipeline?tab=OFFER"
          hint={offers === 0 ? "Offers follow interviews — keep the conversations going →" : undefined}
        />
      </div>

      <InsightsActions />

      <Section title="Pipeline by stage">
        {stageCounts.map((s) => (
          <Bar
            key={s.key}
            label={s.label}
            value={s.n}
            pct={(s.n / maxStage) * 100}
            total={total}
            tone={s.key === "OFFER" ? "positive" : "neutral"}
            href={`/pipeline?tab=${s.key}`}
          />
        ))}
      </Section>

      <Section title="Score distribution">
        {buckets.map((b) => (
          <Bar key={b.label} label={b.label} value={b.n} pct={(b.n / maxBucket) * 100} total={scores.length} href={`/pipeline?tab=ALL&min=${b.min}&max=${b.max}`} />
        ))}
      </Section>

      <Section title="Top companies" id="companies">
        {topCompanies.map(([name, n]) => (
          <Bar key={name} label={name} value={n} pct={(n / maxCompany) * 100} href={`/pipeline?tab=ALL&q=${encodeURIComponent(name)}`} />
        ))}
      </Section>
    </div>
  );
}

function Stat({ value, label, hint, href }: { value: number | string; label: string; hint?: string; href?: string }) {
  const content = (
    <>
      <div className="text-3xl font-semibold tabular-nums">{value}</div>
      <div className="mt-1 text-xs text-faint">{label}</div>
      {hint && (
        <span className="mt-2 block text-xs text-muted transition-colors group-hover:text-brand">
          {hint}
        </span>
      )}
    </>
  );
  return href ? <Link href={href} className="group block rounded-2xl border border-border bg-surface/50 p-4 transition-colors hover:border-brand/40 hover:bg-brand-soft/20">{content}</Link> : <div className="rounded-2xl border border-border bg-surface/50 p-4">{content}</div>;
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
  href,
}: {
  label: string;
  value: number;
  pct: number;
  total?: number;
  tone?: "neutral" | "positive";
  href?: string;
}) {
  const share = total && total > 0 ? Math.round((value / total) * 100) : null;
  const fill =
    tone === "positive"
      ? "bg-gradient-to-r from-emerald-500/60 to-emerald-500/30"
      : "bg-gradient-to-r from-foreground/25 to-foreground/10";
  const content = (
    <>
      <div className="w-32 shrink-0 truncate text-sm text-muted">{label}</div>
      <div className="relative h-7 flex-1 overflow-hidden rounded-md bg-surface">
        <div
          className={`h-full rounded-md ${fill}`}
          style={{ width: `${Math.max(pct, value > 0 ? 4 : 0)}%` }}
        />
      </div>
      <div className="w-20 shrink-0 text-right text-sm tabular-nums">
        {value}
        {share !== null && <span className="ml-1 text-xs text-faint">{share}%</span>}
      </div>
    </>
  );
  return href && value > 0 ? <Link href={href} className="flex items-center gap-3 rounded-lg py-1 transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40">{content}</Link> : <div className="flex items-center gap-3 py-1">{content}</div>;
}
