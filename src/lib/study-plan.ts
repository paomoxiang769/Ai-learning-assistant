import OpenAI from "openai";
import { fetch as undiciFetch, ProxyAgent } from "undici";
import {
  buildWeaknessHeuristicSignals,
  type WeaknessHeuristicSignal,
} from "./weakness-detection.ts";

export const DEFAULT_STUDY_PLAN_MODEL = "gpt-4o-mini";

export type StudyPlanSignals = {
  recentChatsCount: number;
  recentQuizzesCount: number;
  recentNotesCount: number;
  recentFlashcardsCount: number;
  mostStudiedDocumentTitle?: string;
};

export type StudyPlanActivity = {
  recentChats: Array<{
    documentTitle: string;
    role: "user" | "assistant";
    excerpt: string;
    createdAt: string;
  }>;
  recentNotes: Array<{
    documentTitle: string;
    title: string | null;
    excerpt: string;
    createdAt: string;
  }>;
  recentQuizzes: Array<{
    documentTitle: string;
    title: string | null;
    excerpts: string[];
    createdAt: string;
  }>;
  recentFlashcards: Array<{
    documentTitle: string;
    question: string;
    answer: string;
    createdAt: string;
  }>;
  signals: StudyPlanSignals;
};

export type StudyPlanItem = {
  task: string;
  topic?: string;
  reason: string;
  recommendedAction: string;
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

function hasStudyPlanActivity(activity: StudyPlanActivity) {
  return (
    activity.recentChats.length > 0 ||
    activity.recentNotes.length > 0 ||
    activity.recentQuizzes.length > 0 ||
    activity.recentFlashcards.length > 0
  );
}

function formatWeakSignals(signals: WeaknessHeuristicSignal[]) {
  if (signals.length === 0) {
    return "- none";
  }

  return signals
    .map(
      (signal) =>
        `- ${signal.topic}: score ${signal.score}, chats ${signal.chats}, notes ${signal.notes}, quizzes ${signal.quizzes}`,
    )
    .join("\n");
}

function formatActivity(activity: StudyPlanActivity) {
  return [
    "Review-style signals:",
    `- recentChatCount: ${activity.signals.recentChatsCount}`,
    `- recentQuizCount: ${activity.signals.recentQuizzesCount}`,
    `- recentNoteCount: ${activity.signals.recentNotesCount}`,
    `- recentFlashcardCount: ${activity.signals.recentFlashcardsCount}`,
    `- mostStudiedDocument: ${activity.signals.mostStudiedDocumentTitle ?? "none"}`,
    "",
    "Recent chat excerpts:",
    ...activity.recentChats.map(
      (chat) =>
        `- ${chat.documentTitle} (${chat.role}, ${chat.createdAt}): ${chat.excerpt}`,
    ),
    "",
    "Recent note excerpts:",
    ...activity.recentNotes.map(
      (note) =>
        `- ${note.documentTitle} (${note.createdAt}): ${note.title ?? "Untitled note"} - ${note.excerpt}`,
    ),
    "",
    "Recent quiz excerpts:",
    ...activity.recentQuizzes.map(
      (quiz) =>
        `- ${quiz.documentTitle} (${quiz.createdAt}): ${quiz.title ?? "Untitled quiz"} - ${quiz.excerpts.join(" | ")}`,
    ),
    "",
    "Recent flashcards:",
    ...activity.recentFlashcards.map(
      (flashcard) =>
        `- ${flashcard.documentTitle} (${flashcard.createdAt}): Q: ${flashcard.question} | A: ${flashcard.answer}`,
    ),
  ].join("\n");
}

function stripJsonCodeFence(content: string) {
  return content
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStudyPlanItem(value: unknown): StudyPlanItem | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const task = normalizeText(candidate.task);
  const topic = normalizeText(candidate.topic);
  const reason = normalizeText(candidate.reason);
  const recommendedAction = normalizeText(candidate.recommendedAction);

  if (!task || !reason || !recommendedAction) {
    return null;
  }

  return {
    task,
    ...(topic ? { topic } : {}),
    reason,
    recommendedAction,
  };
}

function parseStudyPlan(content: string): StudyPlanItem[] {
  const parsed = JSON.parse(stripJsonCodeFence(content)) as unknown;
  const items =
    Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === "object" && Array.isArray((parsed as { plan?: unknown }).plan)
        ? (parsed as { plan: unknown[] }).plan
        : null;

  if (!items) {
    throw new Error("Study plan response must be a JSON array or an object with a plan array.");
  }

  return items.map(normalizeStudyPlanItem).filter(Boolean).slice(0, 5) as StudyPlanItem[];
}

export async function generateStudyPlan(activity: StudyPlanActivity) {
  if (!hasStudyPlanActivity(activity)) {
    return [];
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const model = process.env.OPENAI_MODEL || DEFAULT_STUDY_PLAN_MODEL;
  const client = createOpenAiClient(apiKey);
  const weakSignals = buildWeaknessHeuristicSignals(activity);
  let completion: OpenAI.Chat.Completions.ChatCompletion;

  try {
    completion = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: [
            "Generate a concise, action-oriented study plan.",
            "Use only the supplied study activity and signals.",
            "Do not invent unsupported topics, documents, or actions.",
            "Return JSON only.",
          ].join(" "),
        },
        {
          role: "user",
          content: [
            "Create Today's Plan as a JSON array.",
            "",
            "3-5 items maximum. If evidence is too thin, return [].",
            "",
            "Each item must have:",
            "- task: short task label",
            "- topic: optional specific topic",
            "- reason: one concise sentence grounded in the activity",
            "- recommendedAction: one action label",
            "",
            "Prefer recommendedAction values from:",
            "- Open Notes",
            "- Generate Quiz",
            "- Review Flashcards",
            "- Review Document",
            "- Ask Follow-up Chat",
            "",
            "Recent study activity:",
            formatActivity(activity),
            "",
            "Lightweight weak topic signals:",
            formatWeakSignals(weakSignals),
          ].join("\n"),
        },
      ],
    });
  } catch (error) {
    throw new Error(`OpenAI study plan request failed: ${getErrorMessage(error)}`);
  }

  const content = completion.choices[0]?.message?.content?.trim() ?? "";

  if (!content) {
    throw new Error("OpenAI study plan response did not include JSON content.");
  }

  try {
    return parseStudyPlan(content);
  } catch (error) {
    throw new Error(`Unable to parse study plan response: ${getErrorMessage(error)}`);
  }
}
