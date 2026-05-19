import { NextResponse, type NextRequest } from "next/server";
import { extractDocumentText } from "@/lib/document-processing";
import { createClient } from "@/lib/supabase/server";

const DOCUMENTS_BUCKET = "documents";
const ALLOWED_FILE_TYPES = new Set(["application/pdf", "text/plain"]);
const ALLOWED_FILE_EXTENSIONS = [".pdf", ".txt"];

export const runtime = "nodejs";

type InsertedDocument = {
  id: string;
};

type ProcessedDocumentCheck = {
  processing_status: string | null;
  raw_text: string | null;
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
    return NextResponse.redirect(new URL("/login", request.url), {
      status: 303,
    });
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

    const { error: updateError } = await supabase
      .from("documents")
      .update({
        raw_text: rawText,
        processing_status: "completed",
      })
      .eq("id", document.id)
      .eq("user_id", user.id);

    if (updateError) {
      const { error: failedStatusError } = await supabase
        .from("documents")
        .update({ processing_status: "failed" })
        .eq("id", document.id)
        .eq("user_id", user.id);

      return redirectToDocument(request, document.id, {
        error: failedStatusError
          ? `Document uploaded, but extracted text could not be saved: ${updateError.message}. Failed to mark document as failed: ${failedStatusError.message}`
          : `Document uploaded, but extracted text could not be saved: ${updateError.message}`,
      });
    }

    const { data: processedDocument, error: processedDocumentError } =
      await supabase
        .from("documents")
        .select("processing_status, raw_text")
        .eq("id", document.id)
        .eq("user_id", user.id)
        .maybeSingle();

    if (processedDocumentError) {
      return redirectToDocument(request, document.id, {
        error: `Document update verification failed: ${processedDocumentError.message}`,
      });
    } else {
      const checkedDocument = processedDocument as ProcessedDocumentCheck | null;
      const persistedRawTextLength = checkedDocument?.raw_text?.length ?? 0;

      if (
        checkedDocument?.processing_status !== "completed" ||
        persistedRawTextLength !== rawText.length
      ) {
        return redirectToDocument(request, document.id, {
          error: `Document update did not persist. Expected processing_status=completed and raw_text length=${rawText.length}, but read back processing_status=${checkedDocument?.processing_status ?? "missing"} and raw_text length=${persistedRawTextLength}. Check the Supabase RLS UPDATE policy for public.documents.`,
        });
      }
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
