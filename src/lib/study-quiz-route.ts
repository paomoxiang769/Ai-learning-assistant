import { NextResponse } from "next/server.js";
import type {
  GenerateStudyQuizOptions,
} from "./study-quiz.ts";
import {
  normalizeStudyQuizPayload,
  normalizeStoredStudyQuizPayload,
  type SavedStudyQuiz,
  type StudyQuizQuestion,
} from "./study-quiz-types.ts";

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

type StudyQuizRouteDependencies = {
  createClient(): Promise<RouteSupabaseClient>;
  generateQuiz(
    documentText: string,
    options: GenerateStudyQuizOptions,
  ): Promise<StudyQuizQuestion[]>;
};

type DocumentRow = {
  id: string;
  file_name: string;
  raw_text: string | null;
  processing_status: "pending" | "completed" | "failed";
};

type SavedQuizRow = {
  id: string;
  document_id: string;
  title: string | null;
  quiz_json: unknown;
  created_at: string;
};

type SavedQuizQuestionRow = {
  quiz_json: unknown;
};

function getCount(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error("count must be a positive number.");
  }

  return Math.max(1, Math.floor(value));
}

function getUniqueSavedQuestions(rows: SavedQuizQuestionRow[]) {
  const questions = rows
    .flatMap((row) => normalizeStoredStudyQuizPayload(row.quiz_json))
    .map((question) => question.question.trim())
    .filter(Boolean);

  return [...new Set(questions)];
}

async function loadSavedQuizQuestions(
  supabase: RouteSupabaseClient,
  documentId: string,
  userId: string,
) {
  const { data, error } = await supabase
    .from("document_quizzes")
    .select("quiz_json")
    .eq("user_id", userId)
    .eq("document_id", documentId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Unable to load saved quiz questions: ${error.message}`);
  }

  return getUniqueSavedQuestions((data ?? []) as SavedQuizQuestionRow[]);
}

export function createStudyQuizRoute(dependencies: StudyQuizRouteDependencies) {
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

    const documentId =
      typeof body.documentId === "string" ? body.documentId.trim() : "";

    if (!documentId) {
      return NextResponse.json({ error: "documentId is required." }, { status: 400 });
    }

    let count: number;

    try {
      count = getCount(body.count);
    } catch (error) {
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : "Invalid request value.",
        },
        { status: 400 },
      );
    }

    try {
      const { data: document, error: documentError } = await supabase
        .from("documents")
        .select("id, file_name, raw_text, processing_status")
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
          { error: "Document is not ready for quiz generation." },
          { status: 409 },
        );
      }

      const shouldSaveQuiz = body.save === true;
      const avoidQuestions = shouldSaveQuiz
        ? await loadSavedQuizQuestions(supabase, userDocument.id, user.id)
        : undefined;
      const generateQuizOptions: GenerateStudyQuizOptions = {
        count,
        documentTitle: userDocument.file_name,
      };

      if (avoidQuestions) {
        generateQuizOptions.avoidQuestions = avoidQuestions;
      }

      const quiz = await dependencies.generateQuiz(
        userDocument.raw_text,
        generateQuizOptions,
      );

      if (!shouldSaveQuiz) {
        return NextResponse.json(quiz);
      }

      const { data: savedQuiz, error: savedQuizError } = await supabase
        .from("document_quizzes")
        .insert({
          document_id: userDocument.id,
          user_id: user.id,
          title: null,
          quiz_json: quiz,
        })
        .select("id")
        .single();

      if (savedQuizError) {
        throw new Error(`Unable to save quiz: ${savedQuizError.message}`);
      }

      const quizId = typeof savedQuiz?.id === "string" ? savedQuiz.id : "";

      if (!quizId) {
        throw new Error("Saved quiz response did not include an id.");
      }

      return NextResponse.json({
        quizId,
        quiz,
      });
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : "Unknown quiz generation error.",
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
      let query = supabase
        .from("document_quizzes")
        .select("id, document_id, title, quiz_json, created_at")
        .eq("user_id", user.id);

      if (documentId) {
        query = query.eq("document_id", documentId);
      }

      const { data, error } = await query.order("created_at", {
        ascending: false,
      });

      if (error) {
        throw new Error(`Unable to load quiz history: ${error.message}`);
      }

      const quizzes: SavedStudyQuiz[] = ((data ?? []) as SavedQuizRow[]).map(
        (row) => {
          const quiz = normalizeStoredStudyQuizPayload(row.quiz_json);

          return {
            id: row.id,
            documentId: row.document_id,
            title: row.title,
            quiz,
            questionCount: quiz.length,
            createdAt: row.created_at,
          };
        },
      );

      return NextResponse.json(quizzes);
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : "Unknown quiz history error.",
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

    const quizId = typeof body.quizId === "string" ? body.quizId.trim() : "";

    if (!quizId) {
      return NextResponse.json({ error: "quizId is required." }, { status: 400 });
    }

    try {
      const { error } = await supabase
        .from("document_quizzes")
        .delete()
        .eq("id", quizId)
        .eq("user_id", user.id);

      if (error) {
        throw new Error(`Unable to delete quiz: ${error.message}`);
      }

      return NextResponse.json({ success: true });
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : "Unknown quiz delete error.",
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
