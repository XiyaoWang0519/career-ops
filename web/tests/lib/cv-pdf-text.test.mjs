import { test } from "node:test";
import assert from "node:assert/strict";
import { extractPdfText } from "../../src/lib/cv/pdf-text.mjs";

test("extractPdfText returns selectable PDF text", async () => {
  const calls = [];
  const fakeExecFile = (bin, args, options, callback) => {
    calls.push({ bin, args, options });
    callback(null, "  Jane Candidate\nExperience  ");
  };

  const result = await extractPdfText("/tmp/cv.pdf", fakeExecFile);

  assert.deepEqual(result, { ok: true, reason: null, text: "Jane Candidate\nExperience" });
  assert.equal(calls[0].bin, "pdftotext");
  assert.deepEqual(calls[0].args, ["-layout", "/tmp/cv.pdf", "-"]);
  assert.equal(calls[0].options.encoding, "utf8");
});

test("extractPdfText identifies image-only PDFs", async () => {
  const fakeExecFile = (_bin, _args, _options, callback) => callback(null, " \n\f ");
  assert.deepEqual(await extractPdfText("/tmp/scanned.pdf", fakeExecFile), {
    ok: false,
    reason: "no-text",
    text: "",
  });
});

test("extractPdfText reports a missing pdftotext executable", async () => {
  const fakeExecFile = (_bin, _args, _options, callback) => {
    const error = new Error("spawn pdftotext ENOENT");
    error.code = "ENOENT";
    callback(error, "");
  };
  assert.deepEqual(await extractPdfText("/tmp/cv.pdf", fakeExecFile), {
    ok: false,
    reason: "unavailable",
    text: "",
  });
});
