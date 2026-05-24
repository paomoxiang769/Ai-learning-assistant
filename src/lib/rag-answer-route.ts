import { NextResponse } from "next/server.js";
import type { RagAnswerOptions, RagAnswerResult } from "./rag-answer.ts";
import {
  buildDocumentChatHistory,
  buildDocumentChatMessageInsert,
  normalizeDocumentChatMessages,
} from "./document-chat.ts";

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

    if (!documentId) {
      return NextResponse.json(
        { error: "documentId is required." },
        { status: 400 },
      );
    }

    let topK: number | undefined;

    try {
      topK = getTopK(body.topK);
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
        .select("id")
        .eq("id", documentId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (documentError) {
        throw new Error(`Unable to verify document access: ${documentError.message}`);
      }

      if (!document) {
        return NextResponse.json({ error: "Document not found." }, { status: 404 });
      }

      const historyQuery = (await supabase
        .from("document_chat_messages")
        .select("id, role, content, sources, created_at")
        .eq("document_id", documentId)
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })) as {
        data: unknown[] | null;
        error: {
          message: string;
        } | null;
      };

      if (historyQuery.error) {
        throw new Error(`Unable to load chat history: ${historyQuery.error.message}`);
      }

      const history = buildDocumentChatHistory(
        normalizeDocumentChatMessages(historyQuery.data ?? []),
      );
      const { error: userMessageError } = await supabase
        .from("document_chat_messages")
        .insert(
          buildDocumentChatMessageInsert({
            documentId,
            userId: user.id,
            role: "user",
            content: question,
          }),
        );

      if (userMessageError) {
        throw new Error(`Unable to save question: ${userMessageError.message}`);
      }

      const result = await dependencies.answerQuestion(question, {
        documentId,
        topK,
        history,
      });

      const { error: assistantMessageError } = await supabase
        .from("document_chat_messages")
        .insert(
          buildDocumentChatMessageInsert({
            documentId,
            userId: user.id,
            role: "assistant",
            content: result.answer,
            sources: result.chunks,
          }),
        );

      if (assistantMessageError) {
        throw new Error(
          `Unable to save assistant answer: ${assistantMessageError.message}`,
        );
      }

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
