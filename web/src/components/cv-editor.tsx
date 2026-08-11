"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { SelectionActions } from "@/components/agent-ui/selection-actions";
import { ContextCards } from "@/components/agent-ui/context-cards";
import { useAssistant } from "@/components/assistant/assistant-provider";

export function CvEditor() {
  const [content, setContent] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [exists, setExists] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [selection, setSelection] = useState("");
  const { openDock, setInput, send, cliId } = useAssistant();

  useEffect(() => {
    fetch("/api/cv")
      .then((r) => r.json())
      .then((d) => {
        setContent(d.content ?? "");
        setExists(d.exists ?? false);
      })
      .finally(() => setLoaded(true));
  }, []);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/cv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        setDirty(false);
        setExists(true);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  }

  function askAboutSelection(verb: string) {
    if (!selection.trim()) return;
    const prompt = `${verb} this CV passage:\n\n"""${selection.trim()}"""`;
    setInput(prompt);
    openDock();
    if (cliId) send(prompt);
    setSelection("");
  }

  const previewChunks = content
    .split(/\n(?=##\s)/)
    .filter((block) => block.trim())
    .slice(0, 4)
    .map((block, i) => {
      const lines = block.trim().split("\n");
      const title = lines[0]?.replace(/^#+\s*/, "") || `Section ${i + 1}`;
      const body = lines.slice(1).join(" ").replace(/\s+/g, " ").trim().slice(0, 220);
      return {
        id: `cv-${i}`,
        title,
        body: body || "Empty section",
        chars: block.length,
        sourceKind: "CV",
        sourceLabel: "cv.md",
        tone: "teal" as const,
      };
    });

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl tracking-tight text-landing">CV editor</h1>
          <p className="mt-1 text-sm text-muted">
            Edit <code className="text-foreground">cv.md</code> with live preview.
            {!exists && loaded && <span className="ml-1 text-faint">No cv.md yet — start typing to create it.</span>}
          </p>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={saving || !dirty}
          className={cn(
            "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition-colors max-sm:min-h-[44px]",
            dirty
              ? "bg-brand text-brand-foreground hover:bg-brand-200"
              : "border border-border bg-surface text-muted",
          )}
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : saved ? <Check className="size-4" /> : null}
          {saved ? "Saved" : "Save"}
        </button>
      </div>

      {!loaded ? (
        <div className="mt-6 text-sm text-muted">Loading…</div>
      ) : (
        <>
          {previewChunks.length > 0 && (
            <div className="mt-6">
              <ContextCards chunks={previewChunks} totalLabel={`${previewChunks.length} sections`} />
            </div>
          )}
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <textarea
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                setDirty(true);
              }}
              onSelect={(e) => {
                const t = e.currentTarget;
                const selected = t.value.slice(t.selectionStart, t.selectionEnd);
                setSelection(selected);
              }}
              onMouseUp={(e) => {
                const t = e.currentTarget;
                const selected = t.value.slice(t.selectionStart, t.selectionEnd);
                setSelection(selected);
              }}
              placeholder={"# Your Name\n\n## Summary\n…"}
              className="min-h-[28rem] w-full resize-y rounded-2xl border border-border bg-surface/60 p-4 font-mono text-sm leading-relaxed outline-none focus:border-brand/50"
            />
            <div className="report-prose min-h-[28rem] overflow-auto rounded-2xl border border-border bg-surface/40 p-5">
              {content.trim() ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
              ) : (
                <p className="text-sm text-faint">Preview appears here.</p>
              )}
            </div>
          </div>
          <SelectionActions
            className="mt-4"
            selectedText={selection}
            onClear={() => setSelection("")}
            actions={[
              { id: "explain", label: "Explain", onClick: () => askAboutSelection("Explain") },
              { id: "improve", label: "Improve", onClick: () => askAboutSelection("Improve") },
              { id: "shorten", label: "Shorten", onClick: () => askAboutSelection("Shorten") },
              { id: "tone", label: "Tone", onClick: () => askAboutSelection("Adjust the tone of") },
            ]}
          />
        </>
      )}
    </div>
  );
}
