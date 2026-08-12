import { readFile } from "node:fs/promises";

const MAX_PDF_TEXT_BYTES = 2_000_000;

/**
 * Extract selectable text from a local PDF with the bundled PDF.js runtime.
 *
 * This intentionally does not shell out to `pdftotext`: a fresh npm install,
 * container image, or copied deployment must behave the same on every OS.
 */
export async function extractPdfText(
  pdfPath,
  {
    readFileFn = readFile,
    loadPdfJsFn = () => import("pdfjs-dist/legacy/build/pdf.mjs"),
  } = {},
) {
  let pdf;
  try {
    const [{ getDocument }, bytes] = await Promise.all([loadPdfJsFn(), readFileFn(pdfPath)]);
    const loadingTask = getDocument({
      data: new Uint8Array(bytes),
      disableFontFace: true,
      isEvalSupported: false,
      useSystemFonts: true,
    });
    pdf = await loadingTask.promise;

    const pages = [];
    let extractedBytes = 0;
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      let pageText = "";
      for (const item of content.items) {
        if (!("str" in item)) continue;
        pageText += item.str;
        pageText += item.hasEOL ? "\n" : " ";
      }
      const normalized = pageText
        .split(/\r?\n/)
        .map((line) => line.replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .join("\n");
      extractedBytes += Buffer.byteLength(normalized, "utf8");
      if (extractedBytes > MAX_PDF_TEXT_BYTES) {
        return { ok: false, reason: "too-large", text: "" };
      }
      if (normalized) pages.push(normalized);
    }

    const text = pages.join("\n\n").trim();
    return text
      ? { ok: true, reason: null, text }
      : { ok: false, reason: "no-text", text: "" };
  } catch (error) {
    const unavailable = error?.code === "ERR_MODULE_NOT_FOUND" || error?.code === "MODULE_NOT_FOUND";
    const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    return { ok: false, reason: unavailable ? "unavailable" : "failed", text: "", detail };
  } finally {
    try { await pdf?.destroy(); } catch { /* best-effort parser cleanup */ }
  }
}
