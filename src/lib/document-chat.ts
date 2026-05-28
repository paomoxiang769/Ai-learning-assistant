import type { RagChatMessage } from "./rag-answer.ts";
import type { RagAnswerSource } from "./rag-answer-client.ts";

type DocumentChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources: RagAnswerSource[];
};

type DocumentChatMessageInsert = {
  document_id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  sources: RagAnswerSource[] | null;
};

function isValidSource(source: unknown): source is RagAnswerSource {
  if (!source || typeof source !== "object") {
    return false;
  }

  const candidate = source as Record<string, unknown>;

  return (
    typeof candidate.id === "string" &&
    typeof candidate.documentId === "string" &&
    (candidate.documentTitle === undefined ||
      typeof candidate.documentTitle === "string") &&
    typeof candidate.chunkIndex === "number" &&
    typeof candidate.content === "string" &&
    typeof candidate.similarity === "number"
  );
}

function normalizeSources(value: unknown) {
  if (value === null || value === undefined) {
    return [];
  }

  if (!Array.isArray(value) || !value.every(isValidSource)) {
    throw new Error("Invalid persisted chat message sources.");
  }

  return value;
}

export function normalizeDocumentChatMessages(value: unknown): DocumentChatMessage[] {
  if (!Array.isArray(value)) {
    throw new Error("Chat messages must be an array.");
  }

  return value.map((message) => {
    if (!message || typeof message !== "object") {
      throw new Error("Chat messages must be objects.");
    }

    const candidate = message as Record<string, unknown>;

    if (
      typeof candidate.id !== "string" ||
      (candidate.role !== "user" && candidate.role !== "assistant") ||
      typeof candidate.content !== "string"
    ) {
      throw new Error("Invalid persisted chat message.");
    }

    return {
      id: candidate.id,
      role: candidate.role,
      content: candidate.content,
      sources: normalizeSources(candidate.sources),
    };
  });
}

export function buildDocumentChatHistory(
  messages: DocumentChatMessage[],
): RagChatMessage[] {
  return messages
    .filter((message) => message.content.trim())
    .map((message) => ({
      role: message.role,
      content: message.content,
    }));
}

export function buildDocumentChatMessageInsert(input: {
  documentId: string;
  userId: string;
  role: "user" | "assistant";
  content: string;
  sources?: RagAnswerSource[];
}): DocumentChatMessageInsert {
  return {
    document_id: input.documentId,
    user_id: input.userId,
    role: input.role,
    content: input.content,
    sources: input.role === "assistant" ? (input.sources ?? []) : null,
  };
}

export type { DocumentChatMessage, DocumentChatMessageInsert };
