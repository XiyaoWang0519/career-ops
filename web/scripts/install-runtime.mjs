#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const playwrightCli = path.join(webRoot, "node_modules", "playwright-core", "cli.js");

console.log("Installing the managed Chromium runtime used by career-ops web…");
let result = spawnSync(process.execPath, [playwrightCli, "install", "--with-deps", "chromium"], {
  cwd: webRoot,
  stdio: "inherit",
});

// Some managed/macOS environments reject OS-package installation even though
// Chromium itself is supported. Install the browser payload and let the launch
// smoke test report any genuinely missing shared libraries.
if (result.status !== 0) {
  result = spawnSync(process.execPath, [playwrightCli, "install", "chromium"], {
    cwd: webRoot,
    stdio: "inherit",
  });
}

if (result.status !== 0) {
  console.error("Could not install Chromium. The web app will not start with an incomplete runtime.");
  process.exit(result.status || 1);
}
