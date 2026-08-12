"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { scoreTone } from "@/lib/format";
import { resolveClientCliId } from "@/lib/client-cli";
import { useRuntime } from "@/components/runtime-provider";
import type { JobArtifact } from "@/lib/job-artifacts";

export type JobStep = {
  kind: "tool" | "status";
  label: string;
  ts: number;
  family?: string;
  detail?: string;
};
export type JobResult = { score: number | null; summary: string; tone: "good" | "warn" | "bad" | "muted" };
export type { JobArtifact };

export type Job = {
  id: string;
  title: string;
  subtitle?: string;
  page?: string; // route the job was launched from / refers to
  input?: string; // the URL/posting it processed (links inbox rows to their worker)
  kind?: string;
  batchId?: string; // groups jobs fired together (e.g. "evaluate all Anthropic")
  status: "running" | "done" | "error";
  steps: JobStep[];
  text: string;
  result?: JobResult;
  artifacts?: JobArtifact[];
  cost?: { tokens: number; usd?: number; billing?: "plan" | "metered" | "unknown" };
  startedAt: number;
  endedAt?: number;
};

type StartOpts = { title: string; subtitle?: string; kind: string; input: string; page?: string; batchId?: string };

type ServerRun = {
  id: string;
  kind: string;
  input: string;
  title?: string;
  subtitle?: string;
  page?: string;
  batchId?: string;
  status: "running" | "done" | "error";
  startedAt: number;
  endedAt?: number;
};

type Ctx = {
  jobs: Job[];
  startJob: (opts: StartOpts) => string | null;
  removeJob: (id: string) => void;
  clearFinished: () => void;
};

const JobsContext = createContext<Ctx | null>(null);
export function useJobs() {
  const c = useContext(JobsContext);
  if (!c) throw new Error("useJobs must be used within <JobsProvider>");
  return c;
}

const JOBS_KEY = "career-ops:jobs";

function parseVerdict(text: string): JobResult {
  const m = text.match(/VERDICT:\s*([\d.]+)\s*\/\s*5\s*[—:|-]+\s*(.+)/i);
  if (m) {
    const score = parseFloat(m[1]);
    return { score, summary: m[2].trim().replace(/\s+/g, " ").slice(0, 90), tone: scoreTone(`${score}`) };
  }
  const s = text.match(/\b([0-5](?:\.\d)?)\s*\/\s*5\b/);
  if (s) {
    const score = parseFloat(s[1]);
    return { score, summary: "", tone: scoreTone(`${score}`) };
  }
  return { score: null, summary: "", tone: "muted" };
}

function jobFromServerRun(run: ServerRun): Job {
  return {
    id: run.id,
    title: run.title || `${run.kind} · ${run.input}`.slice(0, 80),
    subtitle: run.subtitle,
    page: run.page,
    input: run.input,
    kind: run.kind,
    batchId: run.batchId,
    status: run.status === "running" ? "running" : run.status,
    steps: [{ kind: "status", label: run.status === "running" ? "Reconnecting…" : "Restoring…", ts: Date.now() }],
    text: "",
    startedAt: run.startedAt || Date.now(),
    endedAt: run.endedAt,
  };
}

export function JobsProvider({ children }: { children: React.ReactNode }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const seq = useRef(0);
  const loaded = useRef(false);
  const listening = useRef(new Set<string>());
  const { defaultCli } = useRuntime();
  const defaultCliRef = useRef(defaultCli);
  defaultCliRef.current = defaultCli;

  const patch = useCallback((id: string, fn: (j: Job) => Job) => {
    setJobs((js) => js.map((j) => (j.id === id ? fn(j) : j)));
  }, []);

  const listenToStream = useCallback(
    async (job: Job, res: Response) => {
      const id = job.id;
      const kind = job.kind || "evaluate";
      const title = job.title;
      const subtitle = job.subtitle;
      const page = job.page;
      const input = job.input || "";

      let text = "";
      let verdictLine = ""; // latched separately so the 8000-char tail can't drop it
      let doneTokens = 0; // per-run token cost, forwarded on the done event (#6)
      let doneCostUsd: number | null = null;
      let doneBilling: "plan" | "metered" | "unknown" | undefined;
      let doneArtifacts: JobArtifact[] | undefined;
      const steps: JobStep[] = [];
      let finished = false;

      const finish = (status: "done" | "error", lastLabel?: string) => {
        if (finished) return;
        finished = true;
        const result = status === "done" ? parseVerdict(verdictLine || text) : undefined;
        const cost =
          status === "done" && doneTokens > 0
            ? { tokens: doneTokens, usd: doneCostUsd ?? undefined, billing: doneBilling }
            : undefined;
        const artifacts = status === "done" && doneArtifacts?.length ? doneArtifacts : undefined;
        patch(id, (j) => ({
          ...j,
          status,
          result,
          artifacts,
          cost,
          endedAt: Date.now(),
          steps: lastLabel ? [...j.steps, { kind: "status", label: lastLabel, ts: Date.now() }] : j.steps,
        }));
        // persist a readable log file so the CLI/assistant can read past runs
        if (status === "done") {
          fetch("/api/runs/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id,
              title,
              subtitle,
              kind,
              page,
              input,
              result,
              cost,
              steps,
              output: text,
              artifacts,
            }),
          }).catch(() => {});
          // Tell server-snapshot surfaces (Today, pipeline) to refetch — the
          // worker just wrote a real tracker row / report they don't yet see.
          if (typeof window !== "undefined" && (kind === "evaluate" || kind === "pdf")) {
            window.dispatchEvent(new CustomEvent("co-job-done", { detail: { kind, input } }));
          }
        }
      };

      if (!res.ok || !res.body) {
        const e = await res.json().catch(() => ({}));
        finish("error", (e as { error?: string }).error || "Failed to attach");
        return;
      }

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          try {
            const ev = JSON.parse(line);
            if (ev.type === "tool") {
              const step: JobStep = {
                kind: "tool",
                label: ev.name,
                ts: Date.now(),
                ...(typeof ev.family === "string" && ev.family ? { family: ev.family } : {}),
                ...(typeof ev.detail === "string" && ev.detail ? { detail: ev.detail } : {}),
              };
              steps.push(step);
              patch(id, (j) => ({ ...j, steps: [...j.steps, step] }));
            } else if (ev.type === "status") {
              steps.push({ kind: "status", label: ev.label, ts: Date.now() });
              patch(id, (j) => ({ ...j, steps: [...j.steps, { kind: "status", label: ev.label, ts: Date.now() }] }));
            } else if (ev.type === "text") {
              const full = text + ev.text;
              const vm = full.match(/VERDICT:[^\n]*/i);
              if (vm) verdictLine = vm[0];
              text = full.slice(-8000);
              patch(id, (j) => ({ ...j, text }));
            } else if (ev.type === "done") {
              // finish happens on stream-close; capture the per-run cost it carries
              if (typeof ev.tokens === "number") doneTokens = ev.tokens;
              if (typeof ev.costUsd === "number") doneCostUsd = ev.costUsd;
              if (ev.billing === "plan" || ev.billing === "metered" || ev.billing === "unknown") doneBilling = ev.billing;
              if (Array.isArray(ev.artifacts)) doneArtifacts = ev.artifacts as JobArtifact[];
            } else if (ev.type === "error") {
              finish("error", ev.msg || "Error");
              return;
            }
          } catch {
            /* skip */
          }
        }
      }
      finish("done", "Done");
    },
    [patch],
  );

  const attachJob = useCallback(
    async (job: Job, mode: "start" | "reattach", cliId?: string | null) => {
      if (listening.current.has(job.id)) return;
      listening.current.add(job.id);
      try {
        if (mode === "reattach") {
          // Replay rebuilds the trace from the server buffer — clear local
          // partials so tool/status lines aren't duplicated after refresh.
          patch(job.id, (j) => ({
            ...j,
            status: "running",
            text: "",
            result: undefined,
            artifacts: undefined,
            cost: undefined,
            endedAt: undefined,
            steps: [{ kind: "status", label: "Reconnected…", ts: Date.now() }],
          }));
          const res = await fetch(`/api/run/${encodeURIComponent(job.id)}`);
          await listenToStream(job, res);
          return;
        }

        if (!cliId) {
          patch(job.id, (j) => ({
            ...j,
            status: "error",
            endedAt: Date.now(),
            steps: [...j.steps, { kind: "status", label: "No AI tool configured — open Config", ts: Date.now() }],
          }));
          return;
        }

        const res = await fetch("/api/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: job.id,
            kind: job.kind,
            input: job.input,
            cliId,
            title: job.title,
            subtitle: job.subtitle,
            page: job.page,
            batchId: job.batchId,
          }),
        });
        await listenToStream(job, res);
      } catch {
        patch(job.id, (j) =>
          j.status === "running"
            ? {
                ...j,
                status: "error",
                endedAt: Date.now(),
                steps: [...j.steps, { kind: "status", label: "Connection error", ts: Date.now() }],
              }
            : j,
        );
      } finally {
        listening.current.delete(job.id);
      }
    },
    [listenToStream, patch],
  );

  // restore history: merge localStorage + server-owned in-flight runs + disk logs
  // so Activity survives reloads. Running jobs reattach instead of interrupting.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let local: Job[] = [];
      try {
        const raw = localStorage.getItem(JOBS_KEY);
        const arr = raw ? JSON.parse(raw) : null;
        if (Array.isArray(arr)) local = arr as Job[];
      } catch {
        /* ignore */
      }

      let serverRuns: ServerRun[] = [];
      try {
        const res = await fetch("/api/runs/active");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.runs)) serverRuns = data.runs as ServerRun[];
        }
      } catch {
        /* offline / first load */
      }

      let persisted: Job[] = [];
      try {
        const res = await fetch("/api/runs");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.runs)) persisted = data.runs as Job[];
        }
      } catch {
        /* offline / first load */
      }
      if (cancelled) return;

      const serverById = new Map(serverRuns.map((r) => [r.id, r]));
      const reattachIds: string[] = [];

      const resolvedLocal = local.map((j) => {
        if (j.status !== "running") return j;
        const server = serverById.get(j.id);
        if (server) {
          reattachIds.push(j.id);
          return {
            ...j,
            status: "running" as const,
            kind: j.kind || server.kind,
            input: j.input || server.input,
            title: j.title || server.title || j.title,
            subtitle: j.subtitle || server.subtitle,
            page: j.page || server.page,
            batchId: j.batchId || server.batchId,
            startedAt: j.startedAt || server.startedAt,
          };
        }
        return {
          ...j,
          status: "error" as const,
          endedAt: j.endedAt || Date.now(),
          steps: [...(j.steps || []), { kind: "status" as const, label: "Interrupted (page reloaded)", ts: Date.now() }],
        };
      });

      const byId = new Map<string, Job>();
      for (const j of persisted) byId.set(j.id, j);
      for (const j of resolvedLocal) byId.set(j.id, j);
      // Server-owned workers the tab doesn't know about yet (other tab / cleared storage).
      for (const run of serverRuns) {
        if (byId.has(run.id)) continue;
        byId.set(run.id, jobFromServerRun(run));
        if (run.status === "running" || run.status === "done" || run.status === "error") {
          reattachIds.push(run.id);
        }
      }

      const merged = [...byId.values()].sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0)).slice(0, 40);
      setJobs(merged);
      loaded.current = true;

      const uniqueAttach = [...new Set(reattachIds)];
      for (const id of uniqueAttach) {
        const job = merged.find((j) => j.id === id);
        if (job) void attachJob(job, "reattach");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attachJob]);

  // persist
  useEffect(() => {
    if (!loaded.current) return;
    try {
      localStorage.setItem(JOBS_KEY, JSON.stringify(jobs.slice(0, 40)));
    } catch {
      /* quota */
    }
  }, [jobs]);

  const startJob = useCallback(
    (opts: StartOpts): string | null => {
      const cliId = resolveClientCliId(defaultCliRef.current);
      const id = `job-${Date.now()}-${seq.current++}`;
      const job: Job = {
        id,
        title: opts.title,
        subtitle: opts.subtitle,
        page: opts.page,
        input: opts.input,
        kind: opts.kind,
        batchId: opts.batchId,
        status: "running",
        steps: [{ kind: "status", label: "Starting…", ts: Date.now() }],
        text: "",
        startedAt: Date.now(),
      };
      setJobs((js) => [job, ...js]);
      void attachJob(job, "start", cliId);
      return id;
    },
    [attachJob],
  );

  const removeJob = useCallback((id: string) => setJobs((js) => js.filter((j) => j.id !== id)), []);
  const clearFinished = useCallback(() => setJobs((js) => js.filter((j) => j.status === "running")), []);

  return <JobsContext.Provider value={{ jobs, startJob, removeJob, clearFinished }}>{children}</JobsContext.Provider>;
}
