import OpenAI from "openai";
import { fetch as undiciFetch, ProxyAgent } from "undici";

export const DEFAULT_REVIEW_MODEL = "gpt-4o-mini";

export type StudyReviewSignals = {
  recentChatsCount: number;
  recentQuizzesCount: number;
  recentNotesCount: number;
  mostStudiedDocumentTitle?: string;
};

export type StudyReviewActivity = {
  recentChats: Array<{
    documentTitle: string;
    role: "user" | "assistant";
    excerpt: string;
    createdAt: string;
  }>;
  recentQuizzes: Array<{
    documentTitle: string;
    questionCount: number;
    createdAt: string;
  }>;
  recentNotes: Array<{
    documentTitle: string;
    title: string | null;
    noteType: "ai_summary" | "manual";
    createdAt: string;
  }>;
  signals: StudyReviewSignals;
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

function formatActivity(activity: StudyReviewActivity) {
  const lines = [
    `Recent chats: ${activity.signals.recentChatsCount}`,
    `Recent quizzes: ${activity.signals.recentQuizzesCount}`,
    `Recent notes: ${activity.signals.recentNotesCount}`,
    activity.signals.mostStudiedDocumentTitle
      ? `Most studied document: ${activity.signals.mostStudiedDocumentTitle}`
      : "Most studied document: none",
    "",
    "Recent chat messages:",
    ...activity.recentChats.map(
      (chat) =>
        `- ${chat.documentTitle} (${chat.role}, ${chat.createdAt}): ${chat.excerpt}`,
    ),
    "",
    "Recent quizzes:",
    ...activity.recentQuizzes.map(
      (quiz) =>
        `- ${quiz.documentTitle} (${quiz.createdAt}): ${quiz.questionCount} questions`,
    ),
    "",
    "Recent notes:",
    ...activity.recentNotes.map(
      (note) =>
        `- ${note.documentTitle} (${note.noteType}, ${note.createdAt}): ${
          note.title ?? "Untitled note"
        }`,
    ),
  ];

  return lines.join("\n");
}

export async function generateReviewAdvice(activity: StudyReviewActivity) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const model = process.env.OPENAI_MODEL || DEFAULT_REVIEW_MODEL;
  const client = createOpenAiClient(apiKey);
  let completion: OpenAI.Chat.Completions.ChatCompletion;

  try {
    completion = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: [
            "Generate concise, personalized study review advice.",
            "Use only the recent study activity provided by the app.",
            "Prefer grounded, practical recommendations over broad motivation.",
          ].join(" "),
        },
        {
          role: "user",
          content: [
            "Write review advice with these sections:",
            "- What to review next",
            "- Why",
            "- Suggested actions",
            "",
            "Keep it short and study-oriented. Mention specific topics or documents when possible.",
            "",
            "Recent study activity:",
            formatActivity(activity),
          ].join("\n"),
        },
      ],
    });
  } catch (error) {
    throw new Error(`OpenAI review request failed: ${getErrorMessage(error)}`);
  }

  const advice = completion.choices[0]?.message?.content?.trim() ?? "";

  if (!advice) {
    throw new Error("OpenAI review response did not include advice text.");
  }

  return advice;
}
