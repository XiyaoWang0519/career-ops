import { test } from "node:test";
import assert from "node:assert/strict";
import { extractPdfText } from "../../src/lib/cv/pdf-text.mjs";
import nextConfig from "../../next.config.mjs";

test("production builds keep PDF.js beside its worker", () => {
  assert.ok(nextConfig.serverExternalPackages.includes("pdfjs-dist"));
});

test("extractPdfText returns selectable PDF text", async () => {
  const calls = { pages: [], destroyed: false };
  const document = {
    numPages: 2,
    async getPage(pageNumber) {
      calls.pages.push(pageNumber);
      return {
        async getTextContent() {
          return pageNumber === 1
            ? { items: [{ str: "Jane Candidate", hasEOL: true }, { str: "Experience", hasEOL: false }] }
            : { items: [{ str: "Skills", hasEOL: false }] };
        },
      };
    },
    async destroy() { calls.destroyed = true; },
  };
  const getDocument = (options) => {
    assert.ok(options.data instanceof Uint8Array);
    return { promise: Promise.resolve(document) };
  };

  const result = await extractPdfText("/tmp/cv.pdf", {
    readFileFn: async () => Buffer.from("fake-pdf"),
    loadPdfJsFn: async () => ({ getDocument }),
  });

  assert.deepEqual(result, { ok: true, reason: null, text: "Jane Candidate\nExperience\n\nSkills" });
  assert.deepEqual(calls.pages, [1, 2]);
  assert.equal(calls.destroyed, true);
});

test("extractPdfText identifies image-only PDFs", async () => {
  const getDocument = () => ({
    promise: Promise.resolve({
      numPages: 1,
      getPage: async () => ({ getTextContent: async () => ({ items: [] }) }),
      destroy: async () => {},
    }),
  });
  assert.deepEqual(await extractPdfText("/tmp/scanned.pdf", {
    readFileFn: async () => Buffer.from("fake-pdf"),
    loadPdfJsFn: async () => ({ getDocument }),
  }), {
    ok: false,
    reason: "no-text",
    text: "",
  });
});

test("extractPdfText reports an incomplete parser installation", async () => {
  const error = new Error("missing parser");
  error.code = "ERR_MODULE_NOT_FOUND";
  assert.deepEqual(await extractPdfText("/tmp/cv.pdf", {
    readFileFn: async () => Buffer.from("fake-pdf"),
    loadPdfJsFn: async () => { throw error; },
  }), {
    ok: false,
    reason: "unavailable",
    text: "",
    detail: "Error: missing parser",
  });
});
