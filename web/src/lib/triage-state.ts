import fs from "node:fs";
import path from "node:path";
import { careerOpsRoot } from "@/lib/career-ops";
import { atomicWrite } from "@/lib/core/safe-write";
import { parseWebShortlist, updateWebShortlist } from "@/lib/triage-format.mjs";

export type SavedRole = { url: string; company: string; role: string };

function shortlistPath(): string {
  return path.join(careerOpsRoot(), "data", "shortlist.md");
}

function pipelinePath(): string {
  return path.join(careerOpsRoot(), "data", "pipeline.md");
}

export function readWebShortlist(): SavedRole[] {
  let md = "";
  try {
    md = fs.readFileSync(shortlistPath(), "utf8");
  } catch {
    return [];
  }
  return parseWebShortlist(md) as SavedRole[];
}

export function writeWebShortlist(items: SavedRole[]): void {
  let current = "";
  try {
    current = fs.readFileSync(shortlistPath(), "utf8");
  } catch {
    current = "# Job Shortlist\n";
  }
  atomicWrite(shortlistPath(), updateWebShortlist(current, items));
}

/** Mark a pipeline URL reviewed/unreviewed in the canonical shared inbox. */
export function setPipelineReviewed(url: string, reviewed: boolean): boolean {
  if (!/^https?:\/\//i.test(url) || /[\r\n|]/.test(url)) return false;
  let md: string;
  try {
    md = fs.readFileSync(pipelinePath(), "utf8");
  } catch {
    return false;
  }
  let changed = false;
  const lines = md.split("\n").map((line) => {
    const match = line.match(/^(\s*-\s*\[)([ xX])(\]\s*)(.+)$/);
    if (!match) return line;
    const rowUrl = match[4].split("|")[0].trim();
    if (rowUrl !== url) return line;
    const mark = reviewed ? "x" : " ";
    if (match[2] === mark) return line;
    changed = true;
    return `${match[1]}${mark}${match[3]}${match[4]}`;
  });
  if (changed) atomicWrite(pipelinePath(), lines.join("\n"));
  return changed;
}

let queue: Promise<unknown> = Promise.resolve();
export function withTriageLock<T>(fn: () => T): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.then(() => undefined, () => undefined);
  return run;
}
