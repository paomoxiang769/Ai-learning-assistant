import { NextResponse, type NextRequest } from "next/server";
import { generateDocumentSummary } from "@/lib/ai-summary";
import { extractDocumentText } from "@/lib/document-processing";
import { persistProcessedDocument } from "@/lib/document-upload-processing";
import { generateEmbedding } from "@/lib/embedding";
import { splitText } from "@/lib/text-chunker";
import { createClient } from "@/lib/supabase/server";

const DOCUMENTS_BUCKET = "documents";
const ALLOWED_FILE_TYPES = new Set(["application/pdf", "text/plain"]);
const ALLOWED_FILE_EXTENSIONS = [".pdf", ".txt"];

export const runtime = "nodejs";

type InsertedDocument = {
  id: string;
};

function redirectToDocuments(request: NextRequest, params: Record<string, string>) {
  const url = new URL("/documents", request.url);

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  return NextResponse.redirect(url, { status: 303 });
}

function redirectToDocument(
  request: NextRequest,
  id: string,
  params: Record<string, string> = {},
) {
  const url = new URL(`/documents/${id}`, request.url);

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  return NextResponse.redirect(url, { status: 303 });
}

function getSafeFileName(fileName: string) {
  const trimmedName = fileName.trim();
  const safeName = trimmedName.replace(/[^a-zA-Z0-9._-]/g, "-");

  return safeName || "document";
}

function hasAllowedExtension(fileName: string) {
  const lowerFileName = fileName.toLowerCase();

  return ALLOWED_FILE_EXTENSIONS.some((extension) =>
    lowerFileName.endsWith(extension),
  );
}

function isAllowedDocumentFile(file: File) {
  return ALLOWED_FILE_TYPES.has(file.type) || hasAllowedExtension(file.name);
}

function getDocumentContentType(file: File) {
  if (file.type) {
    return file.type;
  }

  if (file.name.toLowerCase().endsWith(".txt")) {
    return "text/plain";
  }

  if (file.name.toLowerCase().endsWith(".pdf")) {
    return "application/pdf";
  }

  return "application/octet-stream";
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const formData = await request.formData();
  const uploadedFile = formData.get("document");

  if (!(uploadedFile instanceof File) || !uploadedFile.name) {
    return redirectToDocuments(request, {
      error: "Please choose a PDF or TXT file to upload.",
    });
  }

  if (!isAllowedDocumentFile(uploadedFile)) {
    return redirectToDocuments(request, {
      error: "Only PDF and TXT files are supported.",
    });
  }

  const timestamp = Date.now();
  const safeFileName = getSafeFileName(uploadedFile.name);
  const filePath = `${user.id}/${timestamp}-${safeFileName}`;
  const contentType = getDocumentContentType(uploadedFile);

  const { error: uploadError } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(filePath, uploadedFile, {
      contentType,
      upsert: false,
    });

  if (uploadError) {
    return redirectToDocuments(request, { error: uploadError.message });
  }

  const { data: insertedDocument, error: insertError } = await supabase
    .from("documents")
    .insert({
      user_id: user.id,
      file_name: uploadedFile.name,
      file_path: filePath,
      file_type: contentType,
      file_size: uploadedFile.size,
      processing_status: "pending",
    })
    .select("id")
    .single();

  if (insertError || !insertedDocument) {
    await supabase.storage.from(DOCUMENTS_BUCKET).remove([filePath]);

    return redirectToDocuments(request, {
      error: insertError?.message ?? "Unable to create document record.",
    });
  }

  const document = insertedDocument as InsertedDocument;

  try {
    const rawText = await extractDocumentText(uploadedFile);
    const chunks = splitText(rawText);
    let summary: string | null = null;
    let summaryErrorMessage: string | null = null;

    try {
      summary = await generateDocumentSummary(rawText);
    } catch (error) {
      summaryErrorMessage = getErrorMessage(error);
    }
    const persistenceResult = await persistProcessedDocument({
      documentId: document.id,
      rawText,
      summary,
      chunks,
      generateChunkEmbedding: generateEmbedding,
      persistence: {
        async saveDocument(update) {
          return await supabase
            .from("documents")
            .update(update)
            .eq("id", document.id)
            .eq("user_id", user.id);
        },
        async markFailed() {
          return await supabase
            .from("documents")
            .update({ processing_status: "failed" })
            .eq("id", document.id)
            .eq("user_id", user.id);
        },
        async verifyDocument() {
          return await supabase
            .from("documents")
            .select("processing_status, raw_text, summary")
            .eq("id", document.id)
            .eq("user_id", user.id)
            .maybeSingle();
        },
        async insertChunks(chunkRows) {
          return await supabase.from("document_chunks").insert(chunkRows);
        },
        async updateChunkEmbedding(update) {
          return await supabase
            .from("document_chunks")
            .update({ embedding: update.embedding })
            .eq("id", update.id)
            .eq("document_id", document.id);
        },
      },
    });

    if (persistenceResult.error) {
      return redirectToDocument(request, document.id, {
        error: persistenceResult.error,
      });
    }

    if (summaryErrorMessage || persistenceResult.warning) {
      const params: Record<string, string> = {};

      if (summaryErrorMessage) {
        params.error = `AI summary generation failed: ${summaryErrorMessage}`;
      }

      if (persistenceResult.warning) {
        params.warning = persistenceResult.warning;
      }

      return redirectToDocument(request, document.id, params);
    }
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    const { error: failedStatusError } = await supabase
      .from("documents")
      .update({ processing_status: "failed" })
      .eq("id", document.id)
      .eq("user_id", user.id);

    return redirectToDocument(request, document.id, {
      error: failedStatusError
        ? `Text parsing failed: ${errorMessage}. Failed to mark document as failed: ${failedStatusError.message}`
        : `Text parsing failed: ${errorMessage}`,
    });
  }

  return redirectToDocument(request, document.id);
}
