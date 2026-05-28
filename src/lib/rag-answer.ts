import OpenAI from "openai";
import { fetch as undiciFetch, ProxyAgent } from "undici";
import type { RetrievedChunk } from "./retrieval.ts";
import { retrieveRelevantChunks } from "./retrieval.ts";

const DEFAULT_ANSWER_MODEL = "gpt-4o-mini";
export const MATERIAL_DOES_NOT_MENTION_IT_MESSAGE =
  "The material does not mention it.";

type FetchInitWithDispatcher = RequestInit & {
  dispatcher?: ProxyAgent;
};

type RagChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type RagAnswerResult = {
  answer: string;
  chunks: RetrievedChunk[];
};

type RagAnswerOptions = {
  documentId?: string;
  topK?: number;
  history?: RagChatMessage[];
};

type RagAnswerDependencies = {
  retrieveRelevantChunks(
    query: string,
    documentId?: string,
    topK?: number,
  ): Promise<RetrievedChunk[]>;
  generateAnswerFromChunks?(
    question: string,
    chunks: RetrievedChunk[],
    history?: RagChatMessage[],
  ): Promise<string>;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

function getProxyUrl() {
  return process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
}

function createProxyFetch(proxyUrl: string): typeof fetch {
  const dispatcher = new ProxyAgent(proxyUrl);

  return ((input, init) =>
    undiciFetch(input as Parameters<typeof undiciFetch>[0], {
      ...init,
      dispatcher,
    } as unknown as Parameters<typeof undiciFetch>[1]) as unknown as ReturnType<
      typeof fetch
    >) as typeof fetch;
}

function createOpenAiClient(apiKey: string) {
  const proxyUrl = getProxyUrl();

  return new OpenAI({
    apiKey,
    baseURL: process.env.OPENAI_BASE_URL,
    fetch: proxyUrl ? createProxyFetch(proxyUrl) : globalThis.fetch.bind(globalThis),
  });
}

function formatChunksForPrompt(chunks: RetrievedChunk[]) {
  return chunks
    .map(
      (chunk, index) =>
        [
          `Chunk ${index}`,
          `document_id: ${chunk.documentId}`,
          chunk.documentTitle ? `document_title: ${chunk.documentTitle}` : null,
          `chunk_index: ${chunk.chunkIndex}`,
          `similarity: ${chunk.similarity}`,
          "content:",
          chunk.content,
        ]
          .filter(Boolean)
          .join("\n"),
    )
    .join("\n\n");
}

function normalizeHistory(history: RagChatMessage[] | undefined) {
  return (history ?? [])
    .filter(
      (message) =>
        (message.role === "user" || message.role === "assistant") &&
        message.content.trim(),
    )
    .map((message) => ({
      role: message.role,
      content: message.content.trim(),
    }));
}

export async function generateAnswerFromChunks(
  question: string,
  chunks: RetrievedChunk[],
  history: RagChatMessage[] = [],
) {
  const trimmedQuestion = question.trim();

  if (!trimmedQuestion) {
    throw new Error("Cannot generate RAG answer for empty question.");
  }

  if (chunks.length === 0) {
    return MATERIAL_DOES_NOT_MENTION_IT_MESSAGE;
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const model = process.env.OPENAI_MODEL || DEFAULT_ANSWER_MODEL;
  const client = createOpenAiClient(apiKey);
  let completion: OpenAI.Chat.Completions.ChatCompletion;

  try {
    completion = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: [
            "Answer study questions using only the provided document chunks.",
            "Conversation history can be used to resolve references such as it, that, they, this topic, or follow-up comparison questions.",
            "When the current question depends on the previous topic, combine the history with the current retrieved chunks to produce a grounded answer or comparison.",
            "If the current chunks mention a related concept and the history identifies what is being compared, compare the current chunks with the prior topic from history instead of falling back immediately.",
            `Reply with exactly: "${MATERIAL_DOES_NOT_MENTION_IT_MESSAGE}" only when the history and chunks together cannot support the answer.`,
          ].join(" "),
        },
        ...normalizeHistory(history),
        {
          role: "user",
          content: [
            `Current question: ${trimmedQuestion}`,
            "",
            "Relevant document chunks:",
            formatChunksForPrompt(chunks),
          ].join("\n"),
        },
      ],
    });
  } catch (error) {
    throw new Error(`OpenAI answer request failed: ${getErrorMessage(error)}`);
  }

  const answer = completion.choices[0]?.message?.content?.trim() ?? "";

  if (!answer) {
    throw new Error("OpenAI answer response did not include answer text.");
  }

  return answer;
}

export function createRagAnswerGenerator(dependencies: RagAnswerDependencies) {
  return async function answerQuestion(
    question: string,
    options: RagAnswerOptions = {},
  ): Promise<RagAnswerResult> {
    const trimmedQuestion = question.trim();

    if (!trimmedQuestion) {
      throw new Error("Question is required.");
    }

    const chunks = await dependencies.retrieveRelevantChunks(
      trimmedQuestion,
      options.documentId,
      options.topK,
    );

    if (chunks.length === 0) {
      return {
        answer: MATERIAL_DOES_NOT_MENTION_IT_MESSAGE,
        chunks: [],
      };
    }

    const answer = await (
      dependencies.generateAnswerFromChunks ?? generateAnswerFromChunks
    )(trimmedQuestion, chunks, options.history);

    return {
      answer,
      chunks,
    };
  };
}

export const answerQuestion = createRagAnswerGenerator({
  retrieveRelevantChunks,
});

export type { RagAnswerOptions, RagAnswerResult, RagChatMessage };
