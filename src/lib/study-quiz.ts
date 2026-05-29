import OpenAI from "openai";
import { fetch as undiciFetch, ProxyAgent } from "undici";
import {
  normalizeStudyQuizPayload,
  type StudyQuizQuestion,
} from "./study-quiz-types.ts";

export const DEFAULT_QUIZ_MODEL = "gpt-4o-mini";

type FetchInitWithDispatcher = RequestInit & {
  dispatcher?: ProxyAgent;
};

type GenerateStudyQuizOptions = {
  count: number;
  documentTitle?: string;
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

function normalizeCount(count: number) {
  if (!Number.isFinite(count) || count <= 0) {
    throw new Error("Quiz count must be a positive number.");
  }

  return Math.max(1, Math.floor(count));
}

function stripJsonCodeFence(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue.startsWith("```")) {
    return trimmedValue;
  }

  return trimmedValue
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

export async function generateStudyQuiz(
  documentText: string,
  options: GenerateStudyQuizOptions,
): Promise<StudyQuizQuestion[]> {
  const trimmedDocumentText = documentText.trim();

  if (!trimmedDocumentText) {
    throw new Error("Cannot generate quiz for empty document text.");
  }

  const count = normalizeCount(options.count);
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const model = process.env.OPENAI_MODEL || DEFAULT_QUIZ_MODEL;
  const client = createOpenAiClient(apiKey);
  let completion: OpenAI.Chat.Completions.ChatCompletion;

  try {
    completion = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: [
            "Generate study quiz questions using only the provided study material.",
            "Return valid JSON only.",
            "Do not include markdown fences or extra commentary.",
            "Use a mix of multiple choice and short answer questions when possible.",
          ].join(" "),
        },
        {
          role: "user",
          content: [
            `Count: ${count}`,
            "Schema:",
            "[",
            '  {"question":"...","type":"multiple choice","options":["..."],"answer":"...","explanation":"..."},',
            '  {"question":"...","type":"short answer","answer":"...","explanation":"..."}',
            "]",
            options.documentTitle ? `Document title: ${options.documentTitle}` : null,
            "",
            "Use exactly these type strings:",
            "- multiple choice",
            "- short answer",
            "",
            "Study material:",
            trimmedDocumentText,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    });
  } catch (error) {
    throw new Error(`OpenAI quiz request failed: ${getErrorMessage(error)}`);
  }

  const rawQuiz = completion.choices[0]?.message?.content?.trim() ?? "";

  if (!rawQuiz) {
    throw new Error("OpenAI quiz response did not include quiz content.");
  }

  let parsedQuiz: unknown;

  try {
    parsedQuiz = JSON.parse(stripJsonCodeFence(rawQuiz));
  } catch (error) {
    throw new Error(`OpenAI quiz response was not valid JSON: ${getErrorMessage(error)}`);
  }

  return normalizeStudyQuizPayload(parsedQuiz).slice(0, count);
}

export type { GenerateStudyQuizOptions };
