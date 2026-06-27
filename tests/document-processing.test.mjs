import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import test from "node:test";
import { promisify } from "node:util";
import { extractDocumentText } from "../src/lib/document-processing.ts";

const execFileAsync = promisify(execFile);
const samplePdfBase64 =
  "JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSAvUmVzb3VyY2VzIDw8IC9Gb250IDw8IC9GMSA0IDAgUiA+PiA+PiAvQ29udGVudHMgNSAwIFIgPj4KZW5kb2JqCjQgMCBvYmoKPDwgL1R5cGUgL0ZvbnQgL1N1YnR5cGUgL1R5cGUxIC9CYXNlRm9udCAvSGVsdmV0aWNhID4+CmVuZG9iago1IDAgb2JqCjw8IC9MZW5ndGggNDQgPj4Kc3RyZWFtCkJUCi9GMSAyNCBUZgo3MiA3MjAgVGQKKEhlbGxvIFBERiBwYXJzZXIpIFRqCkVUCmVuZHN0cmVhbQplbmRvYmoKeHJlZgowIDYKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDA5IDAwMDAwIG4gCjAwMDAwMDAwNTggMDAwMDAgbiAKMDAwMDAwMDExNSAwMDAwMCBuIAowMDAwMDAwMjc0IDAwMDAwIG4gCjAwMDAwMDAzNTEgMDAwMDAgbiAKdHJhaWxlcgo8PCAvU2l6ZSA2IC9Sb290IDEgMCBSID4+CnN0YXJ0eHJlZgo0NDQKJSVFT0Y=";

test("extractDocumentText returns text from TXT files", async () => {
  const file = new File(["First line\nSecond line"], "notes.txt", {
    type: "text/plain",
  });

  const text = await extractDocumentText(file);

  assert.equal(text, "First line\nSecond line");
});

test("extractDocumentText returns text from TXT files with an empty MIME type", async () => {
  const file = new File(["Windows TXT"], "notes.txt");

  const text = await extractDocumentText(file);

  assert.equal(text, "Windows TXT");
});

test("extractDocumentText returns text from PDF files", async () => {
  const pdfBytes = Buffer.from(samplePdfBase64, "base64");
  const file = new File([pdfBytes], "sample.pdf", {
    type: "application/pdf",
  });

  const text = await extractDocumentText(file);

  assert.match(text, /Hello PDF parser/);
});

test("extractDocumentText cold-starts when DOMMatrix cannot be polyfilled from native canvas", async () => {
  const script = `
    delete globalThis.DOMMatrix;
    process.getBuiltinModule = undefined;
    const { extractDocumentText } = await import(${JSON.stringify(
      new URL("../src/lib/document-processing.ts", import.meta.url).href,
    )});
    const pdfBytes = Buffer.from(${JSON.stringify(samplePdfBase64)}, "base64");
    const file = new File([pdfBytes], "sample.pdf", { type: "application/pdf" });
    const text = await extractDocumentText(file);
    if (!/Hello PDF parser/.test(text)) {
      throw new Error("PDF text was not extracted.");
    }
  `;

  await execFileAsync(process.execPath, ["--input-type=module", "-e", script], {
    cwd: process.cwd(),
  });
});

test("extractDocumentText configures a bundled PDF worker for serverless runtimes", async () => {
  const script = `
    const { PDFParse } = await import("pdf-parse");
    const { extractDocumentText } = await import(${JSON.stringify(
      new URL("../src/lib/document-processing.ts", import.meta.url).href,
    )});
    const pdfBytes = Buffer.from(${JSON.stringify(samplePdfBase64)}, "base64");
    const file = new File([pdfBytes], "sample.pdf", { type: "application/pdf" });
    await extractDocumentText(file);
    const workerSrc = PDFParse.setWorker();
    if (!workerSrc.startsWith("data:text/javascript")) {
      throw new Error("Expected bundled PDF worker data URL, got " + workerSrc);
    }
  `;

  await execFileAsync(process.execPath, ["--input-type=module", "-e", script], {
    cwd: process.cwd(),
  });
});

test("extractDocumentText rejects unsupported file types", async () => {
  const file = new File(["not supported"], "notes.md", {
    type: "text/markdown",
  });

  await assert.rejects(
    () => extractDocumentText(file),
    /Unsupported document file type/,
  );
});
