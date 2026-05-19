import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const DOCUMENTS_BUCKET = "documents";

type DocumentRow = {
  file_name: string;
  file_path: string;
};

type DownloadRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function redirectToDocumentWithError(
  request: NextRequest,
  id: string,
  message: string,
) {
  const url = new URL(`/documents/${id}`, request.url);
  url.searchParams.set("error", message);

  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest, context: DownloadRouteContext) {
  const { id } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { data: document, error: documentError } = await supabase
    .from("documents")
    .select("file_name, file_path")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (documentError) {
    return NextResponse.json(
      { error: "Unable to load document." },
      { status: 500 },
    );
  }

  if (!document) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  const userDocument = document as DocumentRow;

  if (userDocument.file_path.startsWith("http")) {
    return redirectToDocumentWithError(
      request,
      id,
      "Download failed: document file_path is a URL, but Supabase Storage needs a bucket path.",
    );
  }

  const { data: signedUrl, error: signedUrlError } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(userDocument.file_path, 60, {
      download: userDocument.file_name,
    });

  if (signedUrlError || !signedUrl) {
    return redirectToDocumentWithError(
      request,
      id,
      `Download failed: ${
        signedUrlError?.message ?? "Supabase did not return a signed URL."
      }`,
    );
  }

  return NextResponse.redirect(signedUrl.signedUrl);
}
