#!/usr/bin/env node

import { accessSync, constants } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projectRoot = path.resolve(webRoot, "..");
const requireWeb = createRequire(path.join(webRoot, "package.json"));
const requireCore = createRequire(path.join(projectRoot, "package.json"));
const runtimeMode = process.argv.includes("--runtime");
const installMode = process.argv.includes("--install");
const failures = [];

function pass(message) {
  console.log(`✓ ${message}`);
}

function fail(message, fix) {
  failures.push({ message, fix });
  console.error(`✗ ${message}`);
  if (fix) console.error(`  → ${fix}`);
}

function requirePackage(requireFn, name, installCommand) {
  try {
    requireFn.resolve(`${name}/package.json`);
    pass(`${name} installed`);
  } catch {
    fail(`${name} is missing`, installCommand);
  }
}

function executablePath(bin) {
  const home = os.homedir();
  const dirs = [
    ...(process.env.PATH || "").split(path.delimiter).filter(Boolean),
    path.join(home, ".local", "bin"),
    path.join(home, ".npm-global", "bin"),
    "/opt/homebrew/bin",
    "/usr/local/bin",
    "/usr/bin",
  ];
  const extensions = process.platform === "win32"
    ? ["", ...(process.env.PATHEXT || ".COM;.EXE;.BAT;.CMD").split(";")]
    : [""];
  for (const dir of new Set(dirs)) {
    for (const extension of extensions) {
      const candidate = path.join(dir, `${bin}${extension.toLowerCase()}`);
      try {
        accessSync(candidate, constants.X_OK);
        return candidate;
      } catch {
        // Keep searching.
      }
    }
  }
  return null;
}

async function checkPdfParser() {
  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    if (typeof pdfjs.getDocument !== "function") throw new Error("getDocument export missing");
    pass("bundled PDF text parser loads");
  } catch (error) {
    fail("bundled PDF text parser cannot load", `Run: npm --prefix web ci (${error.message})`);
  }
}

async function checkBrowser() {
  let browser;
  try {
    const { chromium } = await import("playwright-core");
    try {
      browser = await chromium.launch({ headless: true });
    } catch {
      browser = await chromium.launch({ channel: "chrome", headless: true });
    }
    pass("Chromium launches successfully");
  } catch (error) {
    fail(
      "Chromium is missing or cannot launch",
      `Run: npm --prefix web run install:runtime (${error.message})`,
    );
  } finally {
    try { await browser?.close(); } catch { /* best-effort smoke-test cleanup */ }
  }
}

function checkCoreRuntime({ checkCli }) {
  requirePackage(requireCore, "js-yaml", "Run: npm ci (from the career-ops root)");
  requirePackage(requireCore, "playwright", "Run: npm ci (from the career-ops root)");

  try {
    accessSync(projectRoot, constants.R_OK | constants.W_OK);
    pass("career-ops data root is readable and writable");
  } catch {
    fail("career-ops data root is not writable", `Fix permissions for: ${projectRoot}`);
  }

  if (!checkCli) return;

  const supported = {
    claude: "claude",
    codex: "codex",
    gemini: "gemini",
    opencode: "opencode",
    copilot: "copilot",
    qwen: "qwen",
    antigravity: "agy",
  };
  const pinned = (process.env.CAREER_OPS_DEFAULT_CLI || "").trim().toLowerCase();
  if (pinned && !supported[pinned]) {
    fail(`CAREER_OPS_DEFAULT_CLI=${pinned} is unsupported`, `Choose one of: ${Object.keys(supported).join(", ")}`);
    return;
  }
  const installed = Object.entries(supported)
    .map(([id, bin]) => ({ id, path: executablePath(bin) }))
    .filter(({ path: found }) => found);
  if (pinned && !installed.some(({ id }) => id === pinned)) {
    fail(`${pinned} is configured but its executable is missing`, `Install ${pinned}, then rerun npm --prefix web run check:runtime`);
  } else if (installed.length === 0) {
    fail("no supported AI CLI is installed", "Install Codex, Claude Code, Gemini CLI, OpenCode, Copilot CLI, Qwen, or Antigravity");
  } else {
    pass(`AI CLI available (${installed.map(({ id }) => id).join(", ")})`);
  }
}

const phase = runtimeMode ? "runtime" : installMode ? "install" : "build";
console.log(`\ncareer-ops web dependency check (${phase})\n`);
const [major, minor] = process.versions.node.split(".").map(Number);
if (major > 20 || (major === 20 && minor >= 16)) {
  pass(`Node.js ${process.versions.node}`);
} else {
  fail(`Node.js ${process.versions.node} is unsupported`, "Install Node.js 20.16+ (Node.js 22 LTS or newer is recommended)");
}

for (const dependency of ["next", "pdfjs-dist", "playwright-core"]) {
  requirePackage(requireWeb, dependency, "Run: npm --prefix web ci");
}
await checkPdfParser();
await checkBrowser();
if (runtimeMode || installMode) checkCoreRuntime({ checkCli: runtimeMode });

if (failures.length) {
  console.error(`\nDependency check failed with ${failures.length} issue${failures.length === 1 ? "" : "s"}.`);
  process.exit(1);
}
console.log("\nAll required dependencies are installed and usable.\n");
