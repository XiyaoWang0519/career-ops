"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bot, Expand, Keyboard, Loader2, Minimize2, MousePointer2, Play, RotateCcw, UserRound, X } from "lucide-react";
import { useApply } from "@/components/apply/apply-provider";
import { cn } from "@/lib/cn";

type BrowserControl = "agent" | "user" | "review";
type BrowserState = {
  id: string;
  title: string;
  url: string;
  control: BrowserControl;
  viewport: { width: number; height: number };
};

type BrowserInput =
  | { type: "click"; x: number; y: number }
  | { type: "scroll"; deltaX: number; deltaY: number }
  | { type: "text"; text: string }
  | { type: "key"; key: string };

export function BrowserSessionCard({ sessionId, url }: { sessionId: string; url?: string }) {
  const apply = useApply();
  const [currentSessionId, setCurrentSessionId] = useState(sessionId);
  const [state, setState] = useState<BrowserState | null>(null);
  const [frameNonce, setFrameNonce] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [closed, setClosed] = useState(false);
  const [unavailable, setUnavailable] = useState(!sessionId);
  const [reopening, setReopening] = useState(false);
  const [error, setError] = useState("");
  const frameRef = useRef<HTMLImageElement>(null);
  const inputQueueRef = useRef<Promise<void>>(Promise.resolve());
  const textBufferRef = useRef("");
  const textTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const targetUrl = url || apply.url;

  useEffect(() => {
    setCurrentSessionId(sessionId);
    setState(null);
    setClosed(false);
    setUnavailable(!sessionId);
    setError("");
  }, [sessionId]);

  const refreshState = useCallback(async () => {
    if (!currentSessionId) {
      setUnavailable(true);
      return;
    }
    try {
      const res = await fetch(`/api/apply/browser/state?sessionId=${encodeURIComponent(currentSessionId)}`, { cache: "no-store" });
      if (!res.ok) {
        setState(null);
        setUnavailable(true);
        setError(res.status === 404 ? "This browser session ended. Reopen it to continue." : "Could not reconnect to the browser session.");
        return;
      }
      const next = (await res.json()) as BrowserState;
      setState(next);
      setUnavailable(false);
      setError("");
    } catch {
      setState(null);
      setUnavailable(true);
      setError("The local browser service is temporarily unavailable.");
    }
  }, [currentSessionId]);

  useEffect(() => {
    if (closed || !currentSessionId) return;
    void refreshState();
    const stateTimer = window.setInterval(() => void refreshState(), 1000);
    const frameTimer = window.setInterval(() => setFrameNonce((n) => n + 1), 650);
    return () => {
      window.clearInterval(stateTimer);
      window.clearInterval(frameTimer);
    };
  }, [closed, currentSessionId, refreshState]);

  const postControl = useCallback(
    async (control: BrowserControl) => {
      const res = await fetch("/api/apply/browser/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: currentSessionId, control }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not change browser control");
      setState((s) => (s ? { ...s, control: body.control } : s));
    },
    [currentSessionId],
  );

  const transmitInput = useCallback(
    (input: BrowserInput) => {
      // Browser keyboard events can arrive much faster than a round-trip to the
      // server. Keep one ordered lane so characters never overtake each other.
      inputQueueRef.current = inputQueueRef.current
        .catch(() => {})
        .then(async () => {
          const res = await fetch("/api/apply/browser/input", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId: currentSessionId, input }),
          });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error || "Browser input failed");
          }
          setError("");
          setFrameNonce((n) => n + 1);
        })
        .catch((e) => setError(e instanceof Error ? e.message : "Browser input failed"));
      return inputQueueRef.current;
    },
    [currentSessionId],
  );

  const flushText = useCallback(() => {
    if (textTimerRef.current) clearTimeout(textTimerRef.current);
    textTimerRef.current = null;
    const text = textBufferRef.current;
    textBufferRef.current = "";
    if (text) void transmitInput({ type: "text", text });
  }, [transmitInput]);

  const sendInput = useCallback(
    (input: BrowserInput) => {
      if (input.type === "text") {
        textBufferRef.current += input.text;
        if (textTimerRef.current) clearTimeout(textTimerRef.current);
        textTimerRef.current = setTimeout(flushText, 180);
        return;
      }
      // A click or special key is an ordering boundary: send any pending text
      // before the action that follows it.
      flushText();
      void transmitInput(input);
    },
    [flushText, transmitInput],
  );

  useEffect(() => () => {
    if (textTimerRef.current) clearTimeout(textTimerRef.current);
  }, []);

  const humanControl = state?.control === "user" || state?.control === "review";
  const host = useMemo(() => {
    try {
      return state?.url ? new URL(state.url).hostname : "";
    } catch {
      return "";
    }
  }, [state?.url]);

  const takeControl = async () => {
    try {
      await postControl("user");
      frameRef.current?.focus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not take control");
    }
  };

  const returnToAgent = async () => {
    try {
      await postControl("agent");
      if (apply.sessionId === currentSessionId) await apply.resumeAgent();
      await refreshState();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not resume the agent");
    }
  };

  const reopen = async () => {
    if (!targetUrl || reopening) return;
    setReopening(true);
    setClosed(false);
    setUnavailable(false);
    setState(null);
    setError("");
    const previousSessionId = currentSessionId;
    try {
      const nextSessionId = await apply.open(targetUrl, { prefill: true, company: apply.company || undefined });
      if (!nextSessionId) {
        setUnavailable(true);
        setError("Could not reopen the application browser.");
        return;
      }
      setCurrentSessionId(nextSessionId);
      window.dispatchEvent(
        new CustomEvent("co-assistant-browser-session", {
          detail: { oldSessionId: previousSessionId, newSessionId: nextSessionId, url: targetUrl },
        }),
      );
    } catch {
      setUnavailable(true);
      setError("Could not reopen the application browser.");
    } finally {
      setReopening(false);
    }
  };

  const close = async () => {
    if (currentSessionId) {
      await fetch("/api/apply/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: currentSessionId }),
      }).catch(() => {});
    }
    if (apply.sessionId === currentSessionId) apply.reset();
    setClosed(true);
    setExpanded(false);
  };

  const pointer = (e: React.PointerEvent<HTMLImageElement>) => {
    if (!humanControl || !state) return;
    const rect = e.currentTarget.getBoundingClientRect();
    // object-contain can letterbox the screenshot. Map against the rendered
    // image pixels, not the full <img> box, or edge clicks land off-target.
    const scale = Math.min(rect.width / state.viewport.width, rect.height / state.viewport.height);
    const renderedWidth = state.viewport.width * scale;
    const renderedHeight = state.viewport.height * scale;
    const offsetX = (rect.width - renderedWidth) / 2;
    const offsetY = (rect.height - renderedHeight) / 2;
    const localX = e.clientX - rect.left - offsetX;
    const localY = e.clientY - rect.top - offsetY;
    if (localX < 0 || localY < 0 || localX > renderedWidth || localY > renderedHeight) return;
    const x = (localX / renderedWidth) * state.viewport.width;
    const y = (localY / renderedHeight) * state.viewport.height;
    e.currentTarget.focus();
    void sendInput({ type: "click", x, y });
  };

  const key = (e: React.KeyboardEvent<HTMLImageElement>) => {
    if (!humanControl) return;
    if ((e.metaKey || e.ctrlKey) && e.key.length === 1) {
      e.preventDefault();
      void sendInput({ type: "key", key: `ControlOrMeta+${e.key.toUpperCase()}` });
      return;
    }
    if (e.key.length === 1) {
      e.preventDefault();
      void sendInput({ type: "text", text: e.key });
      return;
    }
    if (["Backspace", "Tab", "Enter", "Escape", "Delete", "Home", "End", "PageUp", "PageDown", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) {
      e.preventDefault();
      void sendInput({ type: "key", key: e.key === " " ? "Space" : e.key });
    }
  };

  const frame = (large: boolean) => (
    <div className={cn("relative overflow-hidden bg-black", large ? "h-[calc(100vh-8rem)]" : "aspect-[16/10]") }>
      {!closed && !unavailable && currentSessionId && (
        <img
          ref={frameRef}
          src={`/api/apply/browser/frame?sessionId=${encodeURIComponent(currentSessionId)}&n=${frameNonce}`}
          alt={`Live browser: ${state?.title || "application"}`}
          draggable={false}
          tabIndex={humanControl ? 0 : -1}
          onPointerDown={pointer}
          onKeyDown={key}
          onPaste={(e) => {
            if (!humanControl) return;
            e.preventDefault();
            void sendInput({ type: "text", text: e.clipboardData.getData("text") });
          }}
          onWheel={(e) => {
            if (!humanControl) return;
            e.preventDefault();
            void sendInput({ type: "scroll", deltaX: e.deltaX, deltaY: e.deltaY });
          }}
          className={cn("h-full w-full select-none object-contain outline-none", humanControl ? "cursor-crosshair focus:ring-2 focus:ring-inset focus:ring-brand" : "pointer-events-none")}
        />
      )}
      {!state && !closed && !unavailable && <Loader2 className="absolute left-1/2 top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 animate-spin text-white/70" />}
      {unavailable && !closed && (
        <div className="absolute inset-0 grid place-items-center px-6 text-center">
          <div>
            <div className="text-sm font-medium text-white/80">Browser control needs to reconnect</div>
            <div className="mt-1 text-xs text-white/50">The live session is not kept inside chat history.</div>
            {targetUrl && (
              <button
                type="button"
                onClick={() => void reopen()}
                disabled={reopening}
                className="mx-auto mt-3 inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-1.5 text-xs font-medium text-brand-foreground disabled:opacity-60"
              >
                {reopening ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
                {reopening ? "Reopening…" : "Reopen browser"}
              </button>
            )}
          </div>
        </div>
      )}
      {closed && <div className="absolute inset-0 grid place-items-center text-sm text-white/60">Browser session ended</div>}
      {!humanControl && state && !closed && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2 pt-8 text-xs text-white/80">Watching the agent — take control whenever you need it.</div>
      )}
    </div>
  );

  const toolbar = (large: boolean) => (
    <div className="flex items-center gap-2 border-b border-border bg-surface px-3 py-2">
      <div className={cn("flex size-6 items-center justify-center rounded-full", humanControl ? "bg-blue-500/15 text-blue-500" : "bg-brand-soft text-brand")}>
        {humanControl ? <UserRound className="size-3.5" /> : <Bot className="size-3.5" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-medium">{state?.title || apply.title || "Opening application…"}</div>
        <div className="truncate text-[10px] text-faint">{humanControl ? (state?.control === "review" ? "Your review — submit only when ready" : "Your control — clicks and typing stay out of chat") : "Agent controlling"}{host ? ` · ${host}` : ""}</div>
      </div>
      {!closed && !unavailable && state && (humanControl ? (
        <button onClick={() => void returnToAgent()} className="inline-flex items-center gap-1 rounded-full bg-brand px-2.5 py-1 text-[11px] font-medium text-brand-foreground"><Play className="size-3" /> Continue agent</button>
      ) : (
        <button onClick={() => void takeControl()} className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-medium hover:bg-surface-hover"><MousePointer2 className="size-3" /> Take control</button>
      ))}
      {!unavailable && <button onClick={() => setExpanded(!large)} className="rounded-md p-1 text-faint hover:bg-surface-hover hover:text-foreground" aria-label={large ? "Exit fullscreen" : "Expand browser"}>{large ? <Minimize2 className="size-3.5" /> : <Expand className="size-3.5" />}</button>}
      <button onClick={() => void close()} className="rounded-md p-1 text-faint hover:bg-surface-hover hover:text-foreground" aria-label="Close browser"><X className="size-3.5" /></button>
    </div>
  );

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-border bg-surface/60 shadow-sm">
        {toolbar(false)}
        {frame(false)}
        <div className="flex items-center gap-1.5 border-t border-border px-3 py-1.5 text-[10px] text-faint">
          <Keyboard className="size-3" /> {humanControl ? "Click the frame, then type normally. Paste is supported." : "Live browser stream"}
          {apply.status !== "idle" && apply.sessionId === currentSessionId && <span className="ml-auto">{apply.status}</span>}
        </div>
        {error && <div className="border-t border-red-500/20 bg-red-500/10 px-3 py-1.5 text-[10px] text-red-600">{error}</div>}
      </div>

      {expanded && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-black/70 p-3 backdrop-blur-sm sm:p-6">
          <div className="mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl">
            {toolbar(true)}
            {frame(true)}
          </div>
        </div>
      )}
    </>
  );
}
