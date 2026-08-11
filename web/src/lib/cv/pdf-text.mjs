import { execFile } from "node:child_process";

const MAX_PDF_TEXT_BYTES = 2_000_000;

/**
 * Extract selectable text from a local PDF with Poppler's `pdftotext`.
 *
 * Keeping extraction outside the AI CLI means every supported CLI receives the
 * same plain-text source and never needs permission to read a temp file.
 */
export function extractPdfText(pdfPath, execFileFn = execFile) {
  return new Promise((resolve) => {
    execFileFn(
      "pdftotext",
      ["-layout", pdfPath, "-"],
      { encoding: "utf8", maxBuffer: MAX_PDF_TEXT_BYTES },
      (error, stdout = "") => {
        if (error) {
          resolve({ ok: false, reason: error.code === "ENOENT" ? "unavailable" : "failed", text: "" });
          return;
        }
        const text = String(stdout).trim();
        resolve(text ? { ok: true, reason: null, text } : { ok: false, reason: "no-text", text: "" });
      },
    );
  });
}
