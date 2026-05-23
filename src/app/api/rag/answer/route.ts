import { NextResponse } from "next/server.js";
import {
  answerQuestion,
  type RagAnswerOptions,
  type RagAnswerResult,
} from "../../../../lib/rag-answer.ts";

export const runtime = "nodejs";

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
};

type RagAnswerRouteDependencies = {
  createClient(): Promise<RouteSupabaseClient>;
  answerQuestion(
    question: string,
    options?: RagAnswerOptions,
  ): Promise<RagAnswerResult>;
};

function getTopK(value: unknown) {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error("topK must be a number when provided.");
  }

  return value;
}

export function createRagAnswerRoute(dependencies: RagAnswerRouteDependencies) {
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

    const question =
      typeof body.question === "string" ? body.question.trim() : "";

    if (!question) {
      return NextResponse.json({ error: "Question is required." }, { status: 400 });
    }

    const documentId =
      typeof body.documentId === "string" && body.documentId.trim()
        ? body.documentId.trim()
        : undefined;

    let topK: number | undefined;

    try {
      topK = getTopK(body.topK);
    } catch (error) {
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : "Invalid topK value.",
        },
        { status: 400 },
      );
    }

    try {
      const result = await dependencies.answerQuestion(question, {
        documentId,
        topK,
      });

      return NextResponse.json(result);
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : "Unknown RAG answer error.",
        },
        { status: 500 },
      );
    }
  };
}

export async function POST(request: Request) {
  const { createClient } = await import("../../../../lib/supabase/server.ts");

  return await createRagAnswerRoute({
    createClient,
    answerQuestion,
  })(request);
}
