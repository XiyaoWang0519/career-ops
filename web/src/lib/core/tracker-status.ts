import fs from "node:fs";
import path from "node:path";
import { careerOpsRoot } from "@/lib/career-ops";
import { canonicalizeStatus } from "@/lib/core/states";
import { atomicWrite } from "@/lib/core/safe-write";
import { replaceTrackerStatus } from "@/lib/tracker-status-core.mjs";

export class TrackerStatusError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
  }
}

/** Update one existing tracker row without ever creating a new application. */
export function updateTrackerStatus(n: string, requestedStatus: string): string {
  if (!n || !requestedStatus.trim()) throw new TrackerStatusError("n and status required", 400);
  if (/[|\r\n*]/.test(requestedStatus)) {
    throw new TrackerStatusError("invalid status (table-breaking characters)", 400);
  }

  const canon = canonicalizeStatus(requestedStatus);
  if (!canon) throw new TrackerStatusError(`not a canonical status: ${requestedStatus}`, 400);

  const file = path.join(careerOpsRoot(), "data", "applications.md");
  let md: string;
  try {
    md = fs.readFileSync(file, "utf8");
  } catch {
    throw new TrackerStatusError("tracker not found", 404);
  }

  const updated = replaceTrackerStatus(md, n, canon);
  if (updated == null) throw new TrackerStatusError("row not found", 404);

  try {
    atomicWrite(file, updated);
  } catch {
    throw new TrackerStatusError("write failed", 500);
  }
  return canon;
}
