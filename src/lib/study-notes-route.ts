import { NextResponse } from "next/server.js";
import type { GenerateStudyNotesOptions } from "./study-notes.ts";

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
  from(table: string): any;
};

type StudyNotesRouteDependencies = {
  createClient(): Promise<RouteSupabaseClient>;
  generateNotes(
    documentText: string,
    options?: GenerateStudyNotesOptions,
  ): Promise<string>;
};

type DocumentAccessRow = {
  id: string;
};

type DocumentRow = {
  id: string;
  file_name: string;
  raw_text: string | null;
  summary: string | null;
  processing_status: "pending" | "completed" | "failed";
};

type SavedNoteRow = {
  id: string;
  document_id: string;
  title: string | null;
  content: string;
  note_type: "ai_summary" | "manual";
  created_at: string;
};

function getText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getNullableText(value: unknown) {
  const text = getText(value);

  return text ? text : null;
}

function toSavedNote(row: SavedNoteRow) {
  return {
    id: row.id,
    documentId: row.document_id,
    title: row.title,
    content: row.content,
    noteType: row.note_type,
    createdAt: row.created_at,
  };
}

async function loadOwnedDocument(
  supabase: RouteSupabaseClient,
  documentId: string,
  userId: string,
) {
  const { data, error } = await supabase
    .from("documents")
    .select("id")
    .eq("id", documentId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to verify document access: ${error.message}`);
  }

  return data as DocumentAccessRow | null;
}

async function saveNote(
  supabase: RouteSupabaseClient,
  payload: {
    document_id: string;
    user_id: string;
    title: string | null;
    content: string;
    note_type: "ai_summary" | "manual";
  },
) {
  const { data, error } = await supabase
    .from("document_notes")
    .insert(payload)
    .select("id, document_id, title, content, note_type, created_at")
    .single();

  if (error) {
    throw new Error(`Unable to save note: ${error.message}`);
  }

  return toSavedNote(data as SavedNoteRow);
}

export function createStudyNotesRoute(dependencies: StudyNotesRouteDependencies) {
  async function POST(request: Request) {
    const supabase = await dependencies.createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    let body: Record<string, unknown>;

    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const documentId = getText(body.documentId);

    if (!documentId) {
      return NextResponse.json({ error: "documentId is required." }, { status: 400 });
    }

    try {
      if (body.mode === "ai") {
        const { data: document, error: documentError } = await supabase
          .from("documents")
          .select("id, file_name, raw_text, summary, processing_status")
          .eq("id", documentId)
          .eq("user_id", user.id)
          .maybeSingle();

        if (documentError) {
          throw new Error(`Unable to verify document access: ${documentError.message}`);
        }

        if (!document) {
          return NextResponse.json({ error: "Document not found." }, { status: 404 });
        }

        const userDocument = document as DocumentRow;

        if (
          userDocument.processing_status !== "completed" ||
          !userDocument.raw_text?.trim()
        ) {
          return NextResponse.json(
            { error: "Document is not ready for study notes generation." },
            { status: 409 },
          );
        }

        const content = await dependencies.generateNotes(userDocument.raw_text, {
          documentTitle: userDocument.file_name,
          summary: userDocument.summary,
        });
        const savedNote = await saveNote(supabase, {
          document_id: userDocument.id,
          user_id: user.id,
          title: "Study Notes",
          content,
          note_type: "ai_summary",
        });

        return NextResponse.json(savedNote);
      }

      const content = getText(body.content);

      if (!content) {
        return NextResponse.json({ error: "content is required." }, { status: 400 });
      }

      const document = await loadOwnedDocument(supabase, documentId, user.id);

      if (!document) {
        return NextResponse.json({ error: "Document not found." }, { status: 404 });
      }

      const savedNote = await saveNote(supabase, {
        document_id: document.id,
        user_id: user.id,
        title: getNullableText(body.title),
        content,
        note_type: "manual",
      });

      return NextResponse.json(savedNote);
    } catch (error) {
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : "Unknown study notes error.",
        },
        { status: 500 },
      );
    }
  }

  async function GET(request: Request) {
    const supabase = await dependencies.createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const documentId = new URL(request.url).searchParams
      .get("documentId")
      ?.trim();

    if (!documentId) {
      return NextResponse.json({ error: "documentId is required." }, { status: 400 });
    }

    try {
      const { data, error } = await supabase
        .from("document_notes")
        .select("id, document_id, title, content, note_type, created_at")
        .eq("user_id", user.id)
        .eq("document_id", documentId)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false });

      if (error) {
        throw new Error(`Unable to load notes: ${error.message}`);
      }

      return NextResponse.json(((data ?? []) as SavedNoteRow[]).map(toSavedNote));
    } catch (error) {
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : "Unknown notes history error.",
        },
        { status: 500 },
      );
    }
  }

  async function DELETE(request: Request) {
    const supabase = await dependencies.createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    let body: Record<string, unknown>;

    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const noteId = getText(body.noteId);

    if (!noteId) {
      return NextResponse.json({ error: "noteId is required." }, { status: 400 });
    }

    try {
      const { error } = await supabase
        .from("document_notes")
        .delete()
        .eq("id", noteId)
        .eq("user_id", user.id);

      if (error) {
        throw new Error(`Unable to delete note: ${error.message}`);
      }

      return NextResponse.json({ success: true });
    } catch (error) {
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : "Unknown note delete error.",
        },
        { status: 500 },
      );
    }
  }

  return {
    POST,
    GET,
    DELETE,
  };
}
