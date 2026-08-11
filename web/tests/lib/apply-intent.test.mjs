import { test } from "node:test";
import assert from "node:assert/strict";
import { explicitApplyUrl } from "../../src/lib/apply-intent.mjs";

test("explicit apply commands resolve their concrete HTTP URL", () => {
  assert.equal(explicitApplyUrl("Apply to http://127.0.0.1:3000/api/browser-test"), "http://127.0.0.1:3000/api/browser-test");
  assert.equal(explicitApplyUrl("apply https://example.com/job/42."), "https://example.com/job/42");
});

test("discussion and non-HTTP schemes do not trigger direct browser launch", () => {
  assert.equal(explicitApplyUrl("Should I apply to https://example.com/job/42?"), "");
  assert.equal(explicitApplyUrl("Apply to file:///tmp/form.html"), "");
  assert.equal(explicitApplyUrl("Apply to javascript:alert(1)"), "");
});
