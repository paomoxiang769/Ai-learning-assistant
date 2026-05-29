import { NextResponse } from "next/server.js";
import type {
  GenerateStudyQuizOptions,
} from "./study-quiz.ts";
import type { StudyQuizQuestion } from "./study-quiz-types.ts";

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

function getCount(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error("count must be a positive number.");
  }

  return Math.max(1, Math.floor(value));
}

export function createStudyQuizRoute(dependencies: StudyQuizRouteDependencies) {
  return async function POST(request: Request) {
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

      const quiz = await dependencies.generateQuiz(userDocument.raw_text, {
        count,
        documentTitle: userDocument.file_name,
      });

      return NextResponse.json(quiz);
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : "Unknown quiz generation error.",
        },
        { status: 500 },
      );
    }
  };
}
