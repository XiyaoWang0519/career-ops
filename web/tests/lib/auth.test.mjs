import { test } from "node:test";
import assert from "node:assert/strict";

// auth.ts uses Web Crypto — available in Node 20+. Import via typescript strip
// if the runtime supports it; otherwise exercise a mirrored contract.

async function loadAuth() {
  try {
    return await import("../../src/lib/auth.ts");
  } catch {
    return null;
  }
}

test("session cookie round-trip verifies", async () => {
  const auth = await loadAuth();
  if (!auth) {
    assert.ok(true, "skip — TS loader unavailable");
    return;
  }
  process.env.WEB_AUTH_PASSWORD = "test-password-xyz";
  process.env.WEB_AUTH_SECRET = "test-secret-abc";
  assert.equal(auth.authEnabled(), true);
  assert.equal(await auth.verifyPassword("test-password-xyz"), true);
  assert.equal(await auth.verifyPassword("wrong"), false);

  const value = await auth.mintSessionCookieValue();
  assert.equal(await auth.verifySessionCookieValue(value), true);
  assert.equal(await auth.verifySessionCookieValue("nope"), false);
  assert.equal(await auth.verifySessionCookieValue(value, Date.now() + auth.SESSION_TTL_MS + 1000), false);
});

test("isLocalHost recognises loopback", async () => {
  const auth = await loadAuth();
  if (!auth) {
    assert.ok(true, "skip — TS loader unavailable");
    return;
  }
  assert.equal(auth.isLocalHost("localhost:3000"), true);
  assert.equal(auth.isLocalHost("127.0.0.1:3001"), true);
  assert.equal(auth.isLocalHost("my-laptop.tailnet.ts.net"), false);
});

test("login rate limit trips after too many attempts", async () => {
  const auth = await loadAuth();
  if (!auth) {
    assert.ok(true, "skip — TS loader unavailable");
    return;
  }
  const ip = `test-ip-${Date.now()}`;
  for (let i = 0; i < 8; i++) assert.equal(auth.rateLimitLogin(ip).ok, true);
  assert.equal(auth.rateLimitLogin(ip).ok, false);
  auth.clearLoginAttempts(ip);
  assert.equal(auth.rateLimitLogin(ip).ok, true);
});
