import OpenAI from "openai";
import { fetch as undiciFetch, ProxyAgent } from "undici";

export const DEFAULT_FLASHCARD_MODEL = "gpt-4o-mini";

export type StudyFlashcard = {
  question: string;
  answer: string;
};

export type SavedStudyFlashcard = StudyFlashcard & {
  id: string;
  documentId: string;
  createdAt: string;
};

export type GenerateStudyFlashcardsInput = {
  documentTitle?: string;
  summary: string | null;
  notes: string[];
  quizExcerpts: string[];
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

function getText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getCandidateArray(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  const candidate = value as Record<string, unknown>;

  if (Array.isArray(candidate.flashcards)) {
    return candidate.flashcards;
  }

  if (Array.isArray(candidate.cards)) {
    return candidate.cards;
  }

  return [];
}

export function normalizeFlashcardListPayload(value: unknown): StudyFlashcard[] {
  return getCandidateArray(value)
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const candidate = item as Record<string, unknown>;
      const question = getText(candidate.question);
      const answer = getText(candidate.answer);

      if (!question || !answer) {
        return null;
      }

      return {
        question,
        answer,
      };
    })
    .filter((item): item is StudyFlashcard => item !== null);
}

function buildStudyMaterial(input: GenerateStudyFlashcardsInput) {
  const sections = [
    input.documentTitle ? `Document title: ${input.documentTitle}` : null,
    input.summary?.trim() ? `Summary:\n${input.summary.trim()}` : null,
    input.notes.length > 0 ? `Notes:\n${input.notes.map((note) => `- ${note}`).join("\n")}` : null,
    input.quizExcerpts.length > 0
      ? `Quiz excerpts:\n${input.quizExcerpts.map((quiz) => `- ${quiz}`).join("\n")}`
      : null,
  ].filter(Boolean);

  return sections.join("\n\n");
}

export function hasFlashcardSourceMaterial(input: GenerateStudyFlashcardsInput) {
  return Boolean(
    input.summary?.trim() ||
      input.notes.some((note) => note.trim()) ||
      input.quizExcerpts.some((quiz) => quiz.trim()),
  );
}

export async function generateStudyFlashcards(
  input: GenerateStudyFlashcardsInput,
): Promise<StudyFlashcard[]> {
  if (!hasFlashcardSourceMaterial(input)) {
    throw new Error("Cannot generate flashcards without summary, notes, or quiz material.");
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const model = process.env.OPENAI_MODEL || DEFAULT_FLASHCARD_MODEL;
  const client = createOpenAiClient(apiKey);
  let completion: OpenAI.Chat.Completions.ChatCompletion;

  try {
    completion = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: [
            "Generate compact study flashcards using only the provided study material.",
            "Return valid JSON only.",
            "Do not include markdown fences or extra commentary.",
            "Each flashcard must have a concise question and answer.",
          ].join(" "),
        },
        {
          role: "user",
          content: [
            "Return 5 to 15 flashcards as a JSON array.",
            "Schema:",
            '[{"question":"...","answer":"..."}]',
            "",
            "Prefer core definitions, formulas, contrasts, causes, consequences, and common confusions.",
            "",
            "Study material:",
            buildStudyMaterial(input),
          ].join("\n"),
        },
      ],
    });
  } catch (error) {
    throw new Error(`OpenAI flashcards request failed: ${getErrorMessage(error)}`);
  }

  const rawFlashcards = completion.choices[0]?.message?.content?.trim() ?? "";

  if (!rawFlashcards) {
    throw new Error("OpenAI flashcards response did not include flashcards content.");
  }

  let parsedFlashcards: unknown;

  try {
    parsedFlashcards = JSON.parse(stripJsonCodeFence(rawFlashcards));
  } catch (error) {
    throw new Error(
      `OpenAI flashcards response was not valid JSON: ${getErrorMessage(error)}`,
    );
  }

  const flashcards = normalizeFlashcardListPayload(parsedFlashcards).slice(0, 15);

  if (flashcards.length < 5) {
    throw new Error("OpenAI flashcards response must include at least 5 valid flashcards.");
  }

  return flashcards;
}
