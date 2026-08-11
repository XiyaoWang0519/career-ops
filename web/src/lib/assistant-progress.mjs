/**
 * Convert normalized assistant stream events into the compact, user-facing
 * status shown while a response is still in progress.
 */

/**
 * @typedef {'working'|'searching'|'solving'|'connecting'|'weaving'|'composing'|'shaping'} ProgressOrbState
 * @typedef {{ category: string, text: string, orb: ProgressOrbState }} AssistantProgress
 */

/** @type {AssistantProgress} */
export const DEFAULT_ASSISTANT_PROGRESS = Object.freeze({
  category: "THINKING",
  text: "Working through your request…",
  orb: "solving",
});

function compactText(value) {
  return String(value || "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/[*_`#>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function clipped(value, fallback) {
  const text = compactText(value) || fallback;
  return text.length > 92 ? `${text.slice(0, 89).trimEnd()}…` : text;
}

function commandText(name, detail) {
  const haystack = `${name || ""} ${detail || ""}`.toLowerCase();
  if (/update-system\.mjs\s+check/.test(haystack)) return "Checking for career-ops updates…";
  if (/doctor\.mjs/.test(haystack)) return "Checking career-ops setup…";
  if (/\b(typecheck|tsc\b)/.test(haystack)) return "Checking types…";
  if (/\b(test|node --test)\b/.test(haystack)) return "Running the test suite…";
  if (/\b(next build|npm run build|npx next build)\b/.test(haystack)) return "Building the web app…";
  if (/\bgit\s+(status|diff)\b/.test(haystack)) return "Reviewing current changes…";
  if (/\b(rg|grep|find|fd)\b/.test(haystack)) return "Searching project files…";
  if (/\b(cat|sed|head|tail|less|wc)\b/.test(haystack)) return "Reading project files…";
  return "Running a command…";
}

function integrationText(name, detail) {
  const source = compactText(detail || name)
    .replace(/^mcp__/, "")
    .replace(/__/g, " ")
    .replace(/[._-]+/g, " ")
    .trim();
  if (!source) return "Using a connected tool…";
  const label = source
    .split(/\s+/)
    .slice(0, 4)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  return clipped(`Connecting to ${label}…`, "Using a connected tool…");
}

function webSearchText(detail) {
  const query = compactText(detail).replace(/[.?!…]+$/, "");
  return query
    ? clipped(`Finding ${query}…`, "Searching the web…")
    : "Searching the web…";
}

/**
 * @param {string} text
 * @returns {AssistantProgress}
 */
export function assistantProgressForReasoning(text) {
  const clean = clipped(text, DEFAULT_ASSISTANT_PROGRESS.text);
  if (/\b(draft|write|writing|compose|composing|final answer|final response)\b/i.test(clean)) {
    return { category: "WRITING", text: clean, orb: "composing" };
  }
  if (/\b(connect|integration|browser session)\b/i.test(clean)) {
    return { category: "CONNECTING", text: clean, orb: "connecting" };
  }
  return { category: "THINKING", text: clean, orb: "solving" };
}

/**
 * @param {{ name?: string, detail?: string, family?: string }} event
 * @returns {AssistantProgress}
 */
export function assistantProgressForTool(event) {
  const name = compactText(event?.name);
  const detail = compactText(event?.detail);
  const family = compactText(event?.family).toLowerCase();
  const lowered = name.toLowerCase();

  if (family === "web_search" || /\b(websearch|web search|search_web)\b/.test(lowered)) {
    return { category: "WEB SEARCH", text: webSearchText(detail), orb: "searching" };
  }
  if (family === "file_change" || /\b(edit|write|patch|file change)\b/.test(lowered)) {
    return { category: "EDITING", text: "Updating project files…", orb: "shaping" };
  }
  if (family === "plan" || lowered === "plan") {
    return { category: "PLANNING", text: "Planning next steps…", orb: "solving" };
  }
  if (family === "mcp") {
    return { category: "INTEGRATION", text: integrationText(name, detail), orb: "connecting" };
  }
  if (family === "command") {
    if (/^(rg|grep|find|fd|cat|sed|head|tail|less|wc|ls|pwd)$/.test(lowered)) {
      return {
        category: "READING FILES",
        text: /^(rg|grep|find|fd)$/.test(lowered) ? "Searching project files…" : "Reading project files…",
        orb: "weaving",
      };
    }
    return { category: "SHELL", text: commandText(name, detail), orb: "working" };
  }

  if (/\b(search|find|lookup)\b/.test(lowered)) {
    return { category: "SEARCH", text: "Searching for information…", orb: "searching" };
  }
  if (/\b(read|open|view|get|list)\b/.test(lowered)) {
    return { category: "READING", text: "Reading information…", orb: "weaving" };
  }
  if (/\b(edit|write|patch|create|update)\b/.test(lowered)) {
    return { category: "EDITING", text: "Updating information…", orb: "shaping" };
  }
  if (/^(mcp|tool)$/.test(lowered) || lowered.includes("mcp")) {
    return { category: "INTEGRATION", text: integrationText(name, detail), orb: "connecting" };
  }
  return { category: "TOOL CALL", text: clipped(`Using ${name || "a tool"}…`, "Using a tool…"), orb: "working" };
}
