import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const DOCUMENTS_BUCKET = "documents";

type DocumentRow = {
  file_path: string;
};

type DeleteRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function redirectToDocument(
  request: NextRequest,
  id: string,
  params: Record<string, string>,
) {
  const url = new URL(`/documents/${id}`, request.url);

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  return NextResponse.redirect(url);
}

export async function POST(request: NextRequest, context: DeleteRouteContext) {
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
    .select("file_path")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (documentError) {
    return redirectToDocument(request, id, {
      error: "Unable to load document before deleting it.",
    });
  }

  if (!document) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  const userDocument = document as DocumentRow;
  const { error: storageError } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .remove([userDocument.file_path]);

  if (storageError) {
    return redirectToDocument(request, id, {
      error: "Unable to delete the stored file.",
    });
  }

  const { error: deleteError } = await supabase
    .from("documents")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (deleteError) {
    return redirectToDocument(request, id, {
      error: "The file was removed, but the document record could not be deleted.",
    });
  }

  const url = new URL("/documents", request.url);
  url.searchParams.set("message", "Document deleted successfully.");

  return NextResponse.redirect(url);
}
