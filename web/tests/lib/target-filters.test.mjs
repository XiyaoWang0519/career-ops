import assert from "node:assert/strict";
import test from "node:test";
import { expandLocationTargets, reconcileNegativeRoles } from "../../src/lib/target-filters.mjs";

test("co-op targets remove inherited intern and junior exclusions", () => {
  assert.deepEqual(
    reconcileNegativeRoles(["Intern", "Junior", "Senior", "Java"], ["AI Infrastructure Co-op"]),
    ["Senior", "Java"],
  );
});

test("direct conflicts are removed while unrelated exclusions remain", () => {
  assert.deepEqual(
    reconcileNegativeRoles(["ML", "Sales", "Contract"], ["ML Engineer", "AI Engineer"]),
    ["Sales", "Contract"],
  );
});

test("experienced-role targeting preserves early-career exclusions", () => {
  assert.deepEqual(
    reconcileNegativeRoles(["Intern", "Junior"], ["Staff Platform Engineer"]),
    ["Intern", "Junior"],
  );
});

test("saved comma-separated locations become useful ATS substring filters", () => {
  assert.deepEqual(
    expandLocationTargets(["Toronto, Ontario, Canada"]),
    ["Toronto, Ontario, Canada", "Toronto", "Ontario", "Canada"],
  );
});

test("two-letter region abbreviations are not expanded into broad substrings", () => {
  assert.deepEqual(expandLocationTargets(["Toronto, ON"]), ["Toronto, ON", "Toronto"]);
});
