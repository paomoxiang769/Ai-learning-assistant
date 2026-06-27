const PDF_FILE_TYPE = "application/pdf";
const TXT_FILE_TYPE = "text/plain";
const PDF_FILE_EXTENSION = ".pdf";
const TXT_FILE_EXTENSION = ".txt";

function hasFileExtension(file: File, extension: string) {
  return file.name.toLowerCase().endsWith(extension);
}

function ensurePdfServerDomMatrix() {
  if (typeof globalThis.DOMMatrix !== "undefined") {
    return;
  }

  class TextExtractionDOMMatrix {
    a = 1;
    b = 0;
    c = 0;
    d = 1;
    e = 0;
    f = 0;

    constructor(init?: number[]) {
      if (Array.isArray(init)) {
        [this.a, this.b, this.c, this.d, this.e, this.f] = [
          init[0] ?? 1,
          init[1] ?? 0,
          init[2] ?? 0,
          init[3] ?? 1,
          init[4] ?? 0,
          init[5] ?? 0,
        ];
      }
    }

    multiplySelf() {
      return this;
    }

    preMultiplySelf() {
      return this;
    }

    translate() {
      return this;
    }

    scale() {
      return this;
    }

    invertSelf() {
      return this;
    }
  }

  globalThis.DOMMatrix = TextExtractionDOMMatrix as typeof DOMMatrix;
}

async function extractPdfText(file: File) {
  ensurePdfServerDomMatrix();

  const { PDFParse } = await import("pdf-parse");
  const { getData } = await import("pdf-parse/worker");
  PDFParse.setWorker(getData());

  const buffer = Buffer.from(await file.arrayBuffer());
  const parser = new PDFParse({ data: buffer });

  try {
    const result = await parser.getText();

    return result.text;
  } finally {
    await parser.destroy();
  }
}

export async function extractDocumentText(file: File) {
  if (file.type === TXT_FILE_TYPE || hasFileExtension(file, TXT_FILE_EXTENSION)) {
    return file.text();
  }

  if (file.type === PDF_FILE_TYPE || hasFileExtension(file, PDF_FILE_EXTENSION)) {
    return extractPdfText(file);
  }

  throw new Error(`Unsupported document file type: ${file.type || "unknown"}`);
}
