const PDF_FILE_TYPE = "application/pdf";
const TXT_FILE_TYPE = "text/plain";
const PDF_FILE_EXTENSION = ".pdf";
const TXT_FILE_EXTENSION = ".txt";

function hasFileExtension(file: File, extension: string) {
  return file.name.toLowerCase().endsWith(extension);
}

async function extractPdfText(file: File) {
  const { PDFParse } = await import("pdf-parse");
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
