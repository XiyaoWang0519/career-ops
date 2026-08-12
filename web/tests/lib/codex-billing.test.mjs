import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { codexBillingMode } from "../../src/lib/codex-billing.mjs";

function withAuth(auth, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "career-ops-codex-auth-"));
  try {
    fs.writeFileSync(path.join(dir, "auth.json"), JSON.stringify(auth));
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test("Codex ChatGPT login is labelled as plan billing", () => {
  withAuth({ OPENAI_API_KEY: null, tokens: { access_token: "secret" } }, (codexHome) => {
    assert.equal(codexBillingMode({ env: {}, codexHome }), "plan");
  });
});

test("Codex API key takes precedence as metered billing", () => {
  withAuth({ tokens: { access_token: "secret" } }, (codexHome) => {
    assert.equal(codexBillingMode({ env: { OPENAI_API_KEY: "key" }, codexHome }), "metered");
  });
});

test("missing Codex auth has unknown billing", () => {
  assert.equal(codexBillingMode({ env: {}, codexHome: "/path/that/does/not/exist" }), "unknown");
});
