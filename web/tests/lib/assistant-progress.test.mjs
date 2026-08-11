import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assistantProgressForReasoning,
  assistantProgressForTool,
} from "../../src/lib/assistant-progress.mjs";

test("reasoning uses solving unless the summary describes drafting", () => {
  assert.deepEqual(assistantProgressForReasoning("Checking the current CV."), {
    category: "THINKING",
    text: "Checking the current CV.",
    orb: "solving",
  });
  assert.equal(assistantProgressForReasoning("Drafting the final response.").orb, "composing");
});

test("tool families select distinct orb states and plain-language labels", () => {
  assert.deepEqual(assistantProgressForTool({ family: "web_search", name: "Web search", detail: "resume advice" }), {
    category: "WEB SEARCH",
    text: "Finding resume advice…",
    orb: "searching",
  });
  assert.deepEqual(assistantProgressForTool({ family: "file_change", name: "Edit" }), {
    category: "EDITING",
    text: "Updating project files…",
    orb: "shaping",
  });
  assert.equal(assistantProgressForTool({ family: "mcp", name: "notion.search" }).orb, "connecting");
});

test("read commands weave while other shell commands work", () => {
  assert.deepEqual(assistantProgressForTool({ family: "command", name: "rg", detail: "rg -n secret src" }), {
    category: "READING FILES",
    text: "Searching project files…",
    orb: "weaving",
  });
  assert.deepEqual(
    assistantProgressForTool({ family: "command", name: "node", detail: "node update-system.mjs check" }),
    { category: "SHELL", text: "Checking for career-ops updates…", orb: "working" },
  );
});

test("raw command details are never exposed as the visible action", () => {
  const detail = "/bin/zsh -lc 'node update-system.mjs check --token top-secret'";
  const progress = assistantProgressForTool({ family: "command", name: "/bin/zsh", detail });
  assert.equal(progress.text.includes("top-secret"), false);
  assert.equal(progress.text.startsWith("/bin/zsh"), false);
});
