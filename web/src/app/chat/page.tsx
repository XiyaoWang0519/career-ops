"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowUpRight, RotateCcw, Send, Settings, Sparkles } from "lucide-react";
import { ThinkingOrb } from "thinking-orbs";
import { CoMark } from "@/components/co-mark";
import { PartView, useAssistant } from "@/components/assistant/assistant-provider";
import { cn } from "@/lib/cn";

export default function ChatPage() {
  const {
    messages,
    input,
    setInput,
    busy,
    cliId,
    suggestions,
    send,
    resetChat,
    resolveConfirm,
    jobs,
  } = useAssistant();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const textarea = inputRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`;
  }, [input]);

  const hasConversation = messages.some((message) =>
    message.parts.some((part) => part.type !== "text" || part.text.trim()),
  );
  const last = messages[messages.length - 1];
  const lastHasVisible = last?.parts.some((part) => (part.type === "text" && part.text.trim()) || part.type !== "text");
  const showThinking = busy && !lastHasVisible;

  return (
    <div className="flex min-h-[calc(100vh-1px)] flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-8">
        <div className="flex items-center gap-3">
          <CoMark size={30} />
          <div>
            <h1 className="text-sm font-semibold tracking-tight">Assistant</h1>
            <p className="text-xs text-faint">{cliId ? "Ready to help" : "No AI tool configured"}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={resetChat}
          className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-2 text-xs text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
        >
          <RotateCcw className="size-3.5" />
          New chat
        </button>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-5 py-10 sm:px-8 sm:py-14">
          {!hasConversation ? (
            <div className="flex flex-1 flex-col items-center justify-center pb-12 text-center">
              <div className="mb-7 flex size-28 items-center justify-center rounded-full border border-border bg-surface/60 shadow-sm">
                <ThinkingOrb state="breathing" size={64} aria-label="Assistant is listening" />
              </div>
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-brand-text">career-ops assistant</p>
              <h2 className="mt-3 max-w-xl font-display text-4xl tracking-tight text-landing sm:text-5xl">
                What can I help you move forward?
              </h2>
              <p className="mt-4 max-w-lg text-sm leading-6 text-muted">
                Ask about your pipeline, evaluate a role, improve your CV, or let&apos;s decide what deserves your attention today.
              </p>
            </div>
          ) : (
            <div className="space-y-8 pb-8">
              {messages.map((message, index) => {
                const visible = message.parts.some((part) => (part.type === "text" && part.text.trim()) || part.type !== "text");
                const isLast = index === messages.length - 1;
                return (
                  <div key={index} className={cn("flex gap-3", message.role === "user" ? "justify-end" : "justify-start")}>
                    {message.role === "assistant" && <span className="mt-1 shrink-0"><CoMark size={28} /></span>}
                    <div className={cn("max-w-[min(100%,42rem)]", message.role === "user" && "rounded-2xl bg-brand px-4 py-3 text-brand-foreground")}>
                      {message.role === "user" ? (
                        <p className="whitespace-pre-wrap text-sm leading-6">{message.parts.filter((part) => part.type === "text").map((part) => part.text).join("")}</p>
                      ) : !visible && busy && isLast ? (
                        <div className="flex items-center gap-2 rounded-2xl border border-border bg-surface px-4 py-3 text-xs text-muted">
                          <ThinkingOrb state="solving" size={20} aria-label="Assistant is thinking" />
                          Thinking…
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {message.parts.map((part, partIndex) => (
                            <PartView key={partIndex} part={part} jobs={jobs} onConfirm={resolveConfirm} />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {showThinking && (
                <div className="ml-10 flex items-center gap-2 text-xs text-muted">
                  <ThinkingOrb state="solving" size={20} aria-label="Assistant is thinking" />
                  Thinking…
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto w-full max-w-3xl px-5 pb-5 sm:px-8 sm:pb-8">
        {cliId && !busy && suggestions.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.label}
                type="button"
                onClick={() => send(suggestion.send)}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface/70 px-3 py-1.5 text-xs text-muted transition-colors hover:border-brand/40 hover:bg-brand-soft hover:text-brand"
              >
                <Sparkles className="size-3 text-brand/70" />
                {suggestion.label}
              </button>
            ))}
          </div>
        )}

        {!cliId && (
          <Link
            href="/config"
            className="mb-3 flex items-center gap-2 rounded-xl border border-border bg-surface/60 px-4 py-3 text-xs text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
          >
            <Settings className="size-3.5" />
            Connect an AI tool in Config to enable replies
            <ArrowUpRight className="ml-auto size-3.5" />
          </Link>
        )}

        <div className="rounded-2xl border border-border bg-surface p-2 shadow-lg shadow-black/[0.03]">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  send();
                }
              }}
              placeholder={cliId ? "Ask anything…" : "Connect an AI tool first"}
              rows={1}
              disabled={!cliId}
              className="max-h-44 min-h-12 flex-1 resize-none bg-transparent px-3 py-3 text-sm leading-6 outline-none placeholder:text-faint disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => send()}
              disabled={busy || !input.trim() || !cliId}
              className="mb-1 rounded-xl bg-brand p-3 text-brand-foreground transition-colors hover:bg-brand-200 disabled:opacity-40"
              aria-label="Send message"
            >
              <Send className="size-4" />
            </button>
          </div>
          <p className="px-3 pb-1 text-[10px] text-faint">Enter to send · Shift+Enter for a new line</p>
        </div>
      </div>
    </div>
  );
}
