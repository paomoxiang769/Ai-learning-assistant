import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const DOCUMENTS_BUCKET = "documents";
const ALLOWED_FILE_TYPES = new Set(["application/pdf", "text/plain"]);
const ALLOWED_FILE_EXTENSIONS = [".pdf", ".txt"];

function redirectToDocuments(request: NextRequest, params: Record<string, string>) {
  const url = new URL("/documents", request.url);

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  return NextResponse.redirect(url);
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
  return ALLOWED_FILE_TYPES.has(file.type) && hasAllowedExtension(file.name);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const formData = await request.formData();
  const uploadedFile = formData.get("document");

  if (!(uploadedFile instanceof File) || uploadedFile.size === 0) {
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

  const { error: uploadError } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(filePath, uploadedFile, {
      contentType: uploadedFile.type,
      upsert: false,
    });

  if (uploadError) {
    return redirectToDocuments(request, { error: uploadError.message });
  }

  const { error: insertError } = await supabase.from("documents").insert({
    user_id: user.id,
    file_name: uploadedFile.name,
    file_path: filePath,
    file_type: uploadedFile.type,
    file_size: uploadedFile.size,
  });

  if (insertError) {
    await supabase.storage.from(DOCUMENTS_BUCKET).remove([filePath]);

    return redirectToDocuments(request, { error: insertError.message });
  }

  return redirectToDocuments(request, {
    message: "Document uploaded successfully.",
  });
}
