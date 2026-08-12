// In-memory registry of web workers (evaluate / pdf / research / fix-portal)
// and assistant chat turns. Stored on globalThis so Next.js / Turbopack HMR
// recompiles do not wipe in-flight runs (a plain module Map would be replaced
// and remounts would falsely show "Interrupted (page reloaded)").
//
// Why this exists: POST /api/run used to bind the CLI child to one HTTP
// response. A page refresh aborted the fetch, stream.cancel() SIGTERM'd the
// child, and the client marked the job interrupted. Workers are now
// server-owned: disconnect only drops a subscriber; the child keeps running
// and a remount can reattach by id.

export type ActiveRunMeta = {
  id: string;
  kind: string;
  input: string;
  title?: string;
  subtitle?: string;
  page?: string;
  batchId?: string;
  startedAt: number;
};

export type ActiveRunSnapshot = ActiveRunMeta & {
  status: "running" | "done" | "error";
  endedAt?: number;
  eventCount: number;
};

type FanoutEvent = { seq: number; data: unknown };

type Subscriber = {
  send: (line: Uint8Array) => boolean;
  close: () => void;
};

type ActiveRun = {
  meta: ActiveRunMeta;
  status: "running" | "done" | "error";
  endedAt?: number;
  events: FanoutEvent[];
  nextSeq: number;
  approxBytes: number;
  subscribers: Set<Subscriber>;
  killChild: (() => void) | null;
  gcTimer?: ReturnType<typeof setTimeout>;
};

/** Keep finished runs briefly so a refresh mid-completion can still hydrate. */
const RETAIN_MS = 10 * 60 * 1000;
/** Soft cap so a chatty CLI can't unbounded-grow the ring buffer. */
const MAX_BUFFER_BYTES = 2_000_000;

// Survive Next.js / Turbopack HMR: a plain module-level Map is replaced on
// recompile, which made remounts think in-flight workers were gone and mark
// them "Interrupted (page reloaded)" even though the CLI child was still alive.
type ActiveRunsGlobal = typeof globalThis & {
  __careerOpsActiveRuns?: Map<string, ActiveRun>;
};
const g = globalThis as ActiveRunsGlobal;
const runs: Map<string, ActiveRun> = g.__careerOpsActiveRuns ?? (g.__careerOpsActiveRuns = new Map());
const enc = new TextEncoder();

function snapshot(run: ActiveRun): ActiveRunSnapshot {
  return {
    ...run.meta,
    status: run.status,
    endedAt: run.endedAt,
    eventCount: run.events.length,
  };
}

function dropOldest(run: ActiveRun): void {
  while (run.events.length > 0 && run.approxBytes > MAX_BUFFER_BYTES) {
    const gone = run.events.shift();
    if (!gone) break;
    try {
      run.approxBytes -= Buffer.byteLength(JSON.stringify(gone.data), "utf8");
    } catch {
      run.approxBytes = Math.max(0, run.approxBytes - 256);
    }
  }
  if (run.approxBytes < 0) run.approxBytes = 0;
}

export function createActiveRun(meta: ActiveRunMeta): ActiveRunSnapshot {
  if (runs.has(meta.id)) {
    throw new Error(`run id already exists: ${meta.id}`);
  }
  const run: ActiveRun = {
    meta,
    status: "running",
    events: [],
    nextSeq: 1,
    approxBytes: 0,
    subscribers: new Set(),
    killChild: null,
  };
  runs.set(meta.id, run);
  return snapshot(run);
}

export function attachRunKiller(id: string, kill: () => void): void {
  const run = runs.get(id);
  if (run) run.killChild = kill;
}

export function pushRunEvent(id: string, data: unknown): void {
  const run = runs.get(id);
  if (!run || run.status !== "running") return;

  const ev: FanoutEvent = { seq: run.nextSeq++, data };
  let size = 256;
  try {
    size = Buffer.byteLength(JSON.stringify(data), "utf8");
  } catch {
    /* keep default */
  }
  run.events.push(ev);
  run.approxBytes += size;
  dropOldest(run);

  const line = enc.encode(JSON.stringify(data) + "\n");
  for (const sub of [...run.subscribers]) {
    if (!sub.send(line)) run.subscribers.delete(sub);
  }
}

export function finishActiveRun(id: string, status: "done" | "error"): void {
  const run = runs.get(id);
  if (!run || run.status !== "running") return;
  run.status = status;
  run.endedAt = Date.now();
  run.killChild = null;
  for (const sub of [...run.subscribers]) {
    try {
      sub.close();
    } catch {
      /* already closed */
    }
    run.subscribers.delete(sub);
  }
  if (run.gcTimer) clearTimeout(run.gcTimer);
  run.gcTimer = setTimeout(() => {
    runs.delete(id);
  }, RETAIN_MS);
  // Don't keep the Node process alive solely for retention GC (tests / idle server).
  run.gcTimer.unref?.();
}

/** Explicit abort (not page-unload). Kills the CLI child if still attached. */
export function abortActiveRun(id: string): boolean {
  const run = runs.get(id);
  if (!run) return false;
  try {
    run.killChild?.();
  } catch {
    /* ignore */
  }
  return true;
}

export function getActiveRun(id: string): ActiveRunSnapshot | null {
  const run = runs.get(id);
  return run ? snapshot(run) : null;
}

/** Running workers plus recently finished ones still retained for reconnect. */
export function listKnownRuns(): ActiveRunSnapshot[] {
  return [...runs.values()]
    .map(snapshot)
    .sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));
}

/**
 * Replay buffered NDJSON events (seq > after), then live-tail until the run
 * finishes. Cancelling the stream only unsubscribes — it does NOT kill the child.
 */
export function subscribeActiveRun(id: string, after = 0): ReadableStream<Uint8Array> | null {
  const run = runs.get(id);
  if (!run) return null;

  let sub: Subscriber | null = null;

  return new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const send = (bytes: Uint8Array): boolean => {
        if (closed) return false;
        try {
          controller.enqueue(bytes);
          return true;
        } catch {
          closed = true;
          return false;
        }
      };
      const close = () => {
        if (closed) return;
        closed = true;
        if (sub) {
          run.subscribers.delete(sub);
          sub = null;
        }
        try {
          controller.close();
        } catch {
          /* ignore */
        }
      };

      for (const ev of run.events) {
        if (ev.seq <= after) continue;
        if (!send(enc.encode(JSON.stringify(ev.data) + "\n"))) return;
      }

      if (run.status !== "running") {
        close();
        return;
      }

      sub = { send, close };
      run.subscribers.add(sub);
    },
    cancel() {
      // Page refresh / navigation: drop this consumer only. The CLI child
      // keeps running under the registry until finishActiveRun / abort.
      if (sub) {
        run.subscribers.delete(sub);
        sub = null;
      }
    },
  });
}
