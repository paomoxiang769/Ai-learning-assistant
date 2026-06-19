import { NextResponse } from "next/server.js";
import { normalizeStoredStudyQuizPayload } from "./study-quiz-types.ts";
import {
  hasFlashcardSourceMaterial,
  type GenerateStudyFlashcardsInput,
  type SavedStudyFlashcard,
  type StudyFlashcard,
} from "./study-flashcards.ts";

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

type StudyFlashcardsRouteDependencies = {
  createClient(): Promise<RouteSupabaseClient>;
  generateFlashcards(input: GenerateStudyFlashcardsInput): Promise<StudyFlashcard[]>;
};

type DocumentRow = {
  id: string;
  file_name: string;
  summary: string | null;
  processing_status: "pending" | "completed" | "failed";
};

type NoteRow = {
  content: string;
};

type QuizRow = {
  quiz_json: unknown;
};

type FlashcardRow = {
  id: string;
  document_id: string;
  question: string;
  answer: string;
  created_at: string;
};

function getText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toSavedFlashcard(row: FlashcardRow): SavedStudyFlashcard {
  return {
    id: row.id,
    documentId: row.document_id,
    question: row.question,
    answer: row.answer,
    createdAt: row.created_at,
  };
}

function getQuizExcerpts(rows: QuizRow[]) {
  return rows.flatMap((row) =>
    normalizeStoredStudyQuizPayload(row.quiz_json).map((question) =>
      [
        `Q: ${question.question}`,
        `A: ${question.answer}`,
        question.explanation ? `Explanation: ${question.explanation}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    ),
  );
}

async function loadNotes(
  supabase: RouteSupabaseClient,
  documentId: string,
  userId: string,
) {
  const { data, error } = await supabase
    .from("document_notes")
    .select("content")
    .eq("user_id", userId)
    .eq("document_id", documentId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    throw new Error(`Unable to load notes for flashcards: ${error.message}`);
  }

  return ((data ?? []) as NoteRow[]).map((note) => note.content).filter(Boolean);
}

async function loadQuizExcerpts(
  supabase: RouteSupabaseClient,
  documentId: string,
  userId: string,
) {
  const { data, error } = await supabase
    .from("document_quizzes")
    .select("quiz_json")
    .eq("user_id", userId)
    .eq("document_id", documentId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    throw new Error(`Unable to load quizzes for flashcards: ${error.message}`);
  }

  return getQuizExcerpts((data ?? []) as QuizRow[]);
}

async function loadOwnedDocument(
  supabase: RouteSupabaseClient,
  documentId: string,
  userId: string,
) {
  const { data, error } = await supabase
    .from("documents")
    .select("id, file_name, summary, processing_status")
    .eq("id", documentId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to verify document access: ${error.message}`);
  }

  return data as DocumentRow | null;
}

async function loadFlashcards(
  supabase: RouteSupabaseClient,
  userId: string,
  documentId?: string,
) {
  let query = supabase
    .from("document_flashcards")
    .select("id, document_id, question, answer, created_at")
    .eq("user_id", userId);

  if (documentId) {
    query = query.eq("document_id", documentId);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Unable to load flashcards: ${error.message}`);
  }

  return ((data ?? []) as FlashcardRow[]).map(toSavedFlashcard);
}

export function createStudyFlashcardsRoute(
  dependencies: StudyFlashcardsRouteDependencies,
) {
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
      const document = await loadOwnedDocument(supabase, documentId, user.id);

      if (!document) {
        return NextResponse.json({ error: "Document not found." }, { status: 404 });
      }

      if (document.processing_status !== "completed") {
        return NextResponse.json(
          { error: "Document is not ready for flashcards generation." },
          { status: 409 },
        );
      }

      const [notes, quizExcerpts] = await Promise.all([
        loadNotes(supabase, document.id, user.id),
        loadQuizExcerpts(supabase, document.id, user.id),
      ]);
      const flashcardInput: GenerateStudyFlashcardsInput = {
        documentTitle: document.file_name,
        summary: document.summary,
        notes,
        quizExcerpts,
      };

      if (!hasFlashcardSourceMaterial(flashcardInput)) {
        return NextResponse.json(
          { error: "Not enough summary, notes, or quiz material to generate flashcards." },
          { status: 409 },
        );
      }

      const generatedFlashcards = await dependencies.generateFlashcards(flashcardInput);
      const rows = generatedFlashcards.slice(0, 15).map((flashcard) => ({
        document_id: document.id,
        user_id: user.id,
        question: flashcard.question,
        answer: flashcard.answer,
      }));

      const { data, error } = await supabase
        .from("document_flashcards")
        .insert(rows)
        .select("id, document_id, question, answer, created_at")
        .order("created_at", { ascending: false });

      if (error) {
        throw new Error(`Unable to save flashcards: ${error.message}`);
      }

      return NextResponse.json(((data ?? []) as FlashcardRow[]).map(toSavedFlashcard));
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : "Unknown flashcards generation error.",
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

    try {
      return NextResponse.json(await loadFlashcards(supabase, user.id, documentId));
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : "Unknown flashcards load error.",
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

    const flashcardId = getText(body.flashcardId);

    if (!flashcardId) {
      return NextResponse.json({ error: "flashcardId is required." }, { status: 400 });
    }

    try {
      const { error } = await supabase
        .from("document_flashcards")
        .delete()
        .eq("id", flashcardId)
        .eq("user_id", user.id);

      if (error) {
        throw new Error(`Unable to delete flashcard: ${error.message}`);
      }

      return NextResponse.json({ success: true });
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : "Unknown flashcard delete error.",
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
