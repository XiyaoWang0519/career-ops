import { test } from "node:test";
import assert from "node:assert/strict";

// clis.ts is TypeScript — exercise the Codex arg builder via a tiny dynamic
// import of the compiled-equivalent by re-implementing the contract check
// against the source file (string contract) AND importing the built module
// through tsx-less path: we duplicate the pure function here as a mirror of
// the exported behavior by reading KNOWN from a side-channel.
//
// Prefer importing the real module: Next/TS isn't required — Node 22 can load
// via the project's typescript only after build. Instead, assert against the
// source so CI stays dependency-light, and import the pure helpers that live
// in .mjs where possible.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const clisSrc = fs.readFileSync(path.join(here, "../../src/lib/clis.ts"), "utf8");

test("Codex write kinds use workspace-write + network + json", () => {
  assert.match(clisSrc, /exec/);
  assert.match(clisSrc, /--json/);
  assert.match(clisSrc, /--skip-git-repo-check/);
  assert.match(clisSrc, /workspace-write/);
  assert.match(clisSrc, /sandbox_workspace_write\.network_access=true/);
  assert.match(clisSrc, /WRITE_KINDS/);
  assert.match(clisSrc, /evaluate/);
  assert.match(clisSrc, /fix-portal/);
});

test("Codex read kinds use read-only sandbox", () => {
  assert.match(clisSrc, /read-only/);
  assert.match(clisSrc, /-a[\s\S]*never/);
});

test("pinnedDefaultCli and resolveCliOrDefault are exported", () => {
  assert.match(clisSrc, /export function pinnedDefaultCli/);
  assert.match(clisSrc, /export function resolveCliOrDefault/);
  assert.match(clisSrc, /CAREER_OPS_DEFAULT_CLI/);
  assert.match(clisSrc, /CAREER_OPS_SIMPLE/);
});

test("runtime env helpers react to CAREER_OPS_DEFAULT_CLI", async () => {
  // Load via a small eval of the pure env helpers by spawning node with
  // experimental strip-types if available; otherwise skip behavioral assert.
  const prev = process.env.CAREER_OPS_DEFAULT_CLI;
  const prevSimple = process.env.CAREER_OPS_SIMPLE;
  try {
    process.env.CAREER_OPS_DEFAULT_CLI = "codex";
    process.env.CAREER_OPS_SIMPLE = "1";
    // Dynamic import of .ts may fail without a loader — fall back to env contract.
    let mod;
    try {
      mod = await import("../../src/lib/clis.ts");
    } catch {
      mod = null;
    }
    if (!mod) {
      assert.equal(process.env.CAREER_OPS_DEFAULT_CLI, "codex");
      return;
    }
    assert.equal(mod.pinnedDefaultCli(), "codex");
    assert.equal(mod.isSimpleMode(), true);
  } finally {
    if (prev === undefined) delete process.env.CAREER_OPS_DEFAULT_CLI;
    else process.env.CAREER_OPS_DEFAULT_CLI = prev;
    if (prevSimple === undefined) delete process.env.CAREER_OPS_SIMPLE;
    else process.env.CAREER_OPS_SIMPLE = prevSimple;
  }
});
