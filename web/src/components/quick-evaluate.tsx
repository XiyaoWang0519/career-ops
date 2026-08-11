"use client";

import { useState } from "react";
import { useJobs } from "@/components/jobs/job-store";
import { PromptBar } from "@/components/agent-ui/prompt-bar";

/** Auto-pipeline via Prompt Bar (Beautiful UI #08). */
export function QuickEvaluate() {
  const { startJob } = useJobs();
  const [url, setUrl] = useState("");
  const [hint, setHint] = useState<string | undefined>("Paste a job URL — evaluation runs on your own AI.");

  function run() {
    const u = url.trim();
    if (!/^https?:\/\//i.test(u)) {
      setHint("Paste a full job-posting URL (https://…).");
      return;
    }
    startJob({ title: "Evaluate · pasted URL", subtitle: u, kind: "evaluate", input: u, page: "/" });
    setUrl("");
    setHint("Evaluating — watch it in the Workers tray.");
  }

  return (
    <div className="mt-7 max-w-xl">
      <PromptBar
        value={url}
        onChange={setUrl}
        onSubmit={run}
        placeholder="Paste a job URL to evaluate…"
        cost="spend"
        hint={hint}
        submitLabel="Evaluate"
        commands={[
          { id: "evaluate", label: "evaluate", hint: "Score a job URL" },
          { id: "scan", label: "scan", hint: "Free portal scan" },
        ]}
        onCommand={(id) => {
          if (id === "scan") window.location.href = "/explore?run=1";
          if (id === "evaluate") setHint("Paste the URL, then hit Evaluate.");
        }}
      />
    </div>
  );
}
