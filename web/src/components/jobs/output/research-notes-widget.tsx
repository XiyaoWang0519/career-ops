import { Badge } from "@/components/ui/badge";
import { scoreTone } from "@/lib/format";

/** Pull short, non-monologue bullets from stream text for display. */
export function extractResearchBullets(text: string, limit = 5): string[] {
  const lines = text
    .split("\n")
    .map((l) => l.replace(/^[-*•]\s+/, "").replace(/^\d+\.\s+/, "").trim())
    .filter((l) => l.length > 28 && l.length < 180)
    .filter((l) => !/^VERDICT:/i.test(l))
    .filter((l) => !/^(I |I'm |I'll |Let me |First |Next |Now |Checking |Reading |Running )/i.test(l))
    .filter((l) => !/`[^`]+`/.test(l) || l.split("`").length < 4);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const l of lines) {
    const key = l.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(l);
    if (out.length >= limit) break;
  }
  return out;
}

export function ResearchNotesWidget({
  summary,
  score,
  text,
}: {
  summary: string;
  score: number | null;
  text: string;
}) {
  const bullets = extractResearchBullets(text);
  return (
    <div className="rounded-2xl border border-border bg-surface/40 px-5 py-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">Research</p>
        {score != null ? <Badge tone={scoreTone(`${score}`)}>{score}/5</Badge> : null}
      </div>
      {summary ? <p className="mt-2 text-sm leading-relaxed text-landing">{summary}</p> : null}
      {bullets.length > 0 ? (
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-muted">
          {bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      ) : !summary ? (
        <p className="mt-2 text-sm text-muted">No structured findings were captured for this run.</p>
      ) : null}
    </div>
  );
}
