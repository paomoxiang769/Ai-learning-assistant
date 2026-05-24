import { NextResponse } from "next/server.js";
import {
  answerQuestion,
  type RagChatMessage,
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

function getHistory(value: unknown): RagChatMessage[] | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new Error("history must be an array when provided.");
  }

  return value.map((message) => {
    if (!message || typeof message !== "object") {
      throw new Error("history items must be objects.");
    }

    const candidate = message as Record<string, unknown>;

    if (
      (candidate.role !== "user" && candidate.role !== "assistant") ||
      typeof candidate.content !== "string"
    ) {
      throw new Error(
        "history items must include role=user|assistant and string content.",
      );
    }

    return {
      role: candidate.role,
      content: candidate.content,
    };
  });
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
    let history: RagChatMessage[] | undefined;

    try {
      topK = getTopK(body.topK);
      history = getHistory(body.history);
    } catch (error) {
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : "Invalid request value.",
        },
        { status: 400 },
      );
    }

    try {
      const result = await dependencies.answerQuestion(question, {
        documentId,
        topK,
        history,
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
