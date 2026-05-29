import { NextResponse } from "next/server.js";

const DOCUMENTS_BUCKET = "documents";

type RouteSupabaseClient = {
  auth: {
    getUser(): Promise<{
      data: {
        user: {
          id: string;
        } | null;
      };
    }>;
  };
  storage: {
    from(bucket: string): {
      remove(paths: string[]): Promise<{
        error: {
          message: string;
        } | null;
      }>;
    };
  };
  from(table: string): any;
};

type DeleteRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type DocumentDeleteRouteDependencies = {
  createClient(): Promise<RouteSupabaseClient>;
};

type DocumentRow = {
  file_path: string;
};

function redirectToDocuments(
  request: Request,
  params: Record<string, string>,
) {
  const url = new URL("/documents", request.url);

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  return NextResponse.redirect(url, { status: 303 });
}

function redirectToDocument(
  request: Request,
  id: string,
  params: Record<string, string>,
) {
  const url = new URL(`/documents/${id}`, request.url);

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  return NextResponse.redirect(url, { status: 303 });
}

function isStorageBucketPath(filePath: string) {
  return filePath.trim() !== "" && !filePath.startsWith("http");
}

async function deleteDocumentChunks(
  supabase: RouteSupabaseClient,
  documentId: string,
) {
  const { error } = await supabase
    .from("document_chunks")
    .delete()
    .eq("document_id", documentId);

  return error?.message ?? null;
}

export function createDocumentDeleteRoute(
  dependencies: DocumentDeleteRouteDependencies,
) {
  async function POST(request: Request, context: DeleteRouteContext) {
    const { id } = await context.params;
    const supabase = await dependencies.createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(new URL("/login", request.url), {
        status: 303,
      });
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
    let storageWarning: string | null = null;

    if (isStorageBucketPath(userDocument.file_path)) {
      const { error: storageError } = await supabase.storage
        .from(DOCUMENTS_BUCKET)
        .remove([userDocument.file_path]);

      if (storageError) {
        storageWarning =
          "Document record was deleted, but the stored file could not be removed.";
      }
    }

    const chunkDeleteWarning = await deleteDocumentChunks(supabase, id);

    const { error: deleteError } = await supabase
      .from("documents")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (deleteError) {
      return redirectToDocument(request, id, {
        error: [
          `The document record could not be deleted: ${deleteError.message}`,
          chunkDeleteWarning
            ? `Document chunks could not be deleted first: ${chunkDeleteWarning}`
            : null,
          storageWarning,
        ]
          .filter(Boolean)
          .join(" "),
      });
    }

    return redirectToDocuments(request, {
      message: "Document deleted successfully.",
      ...(storageWarning || chunkDeleteWarning
        ? {
            warning: [storageWarning, chunkDeleteWarning]
              .filter(Boolean)
              .join(" "),
          }
        : {}),
    });
  }

  return {
    POST,
  };
}
