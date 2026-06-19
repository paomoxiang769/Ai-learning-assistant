import OpenAI from "openai";
import { fetch as undiciFetch, ProxyAgent } from "undici";
import { normalizeStoredStudyQuizPayload } from "./study-quiz-types.ts";

export const DEFAULT_WEAKNESS_MODEL = "gpt-4o-mini";

export type WeaknessConfidence = "High" | "Medium" | "Low";

export type WeakTopic = {
  topic: string;
  confidence: WeaknessConfidence;
  reason: string;
  suggestedAction: string;
};

export type WeaknessDetectionActivity = {
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
};

export type WeaknessHeuristicSignal = {
  topic: string;
  chats: number;
  notes: number;
  quizzes: number;
  score: number;
};

const WEAKNESS_STOP_WORDS = new Set([
  "about",
  "again",
  "add",
  "an",
  "answer",
  "because",
  "can",
  "construction",
  "confused",
  "does",
  "do",
  "explain",
  "explains",
  "from",
  "how",
  "i",
  "into",
  "need",
  "needs",
  "not",
  "question",
  "review",
  "revisit",
  "still",
  "study",
  "table",
  "the",
  "this",
  "transitions",
  "understand",
  "use",
  "whether",
  "what",
  "when",
  "where",
  "which",
  "why",
  "with",
]);

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

function getExcerpt(content: string, maxLength = 180) {
  const normalized = content.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 3)}...`;
}

function titleCaseTopic(topic: string) {
  return topic
    .split(" ")
    .map((word) =>
      word.length <= 3
        ? word.toUpperCase()
        : `${word.charAt(0).toUpperCase()}${word.slice(1)}`,
    )
    .join(" ");
}

function extractTopicCandidates(text: string) {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter(
      (word) =>
        word.length >= 2 &&
        !WEAKNESS_STOP_WORDS.has(word) &&
        !/^\d+$/.test(word),
    );
  const candidates = new Set<string>();

  for (let index = 0; index < words.length; index += 1) {
    candidates.add(words[index]);

    for (const phraseLength of [2, 3]) {
      const phraseWords = words.slice(index, index + phraseLength);

      if (phraseWords.length === phraseLength) {
        candidates.add(phraseWords.join(" "));
      }
    }
  }

  return [...candidates];
}

function addSignals(
  statsByTopic: Map<string, WeaknessHeuristicSignal>,
  source: "chats" | "notes" | "quizzes",
  texts: string[],
) {
  const candidates = new Set(texts.flatMap((text) => extractTopicCandidates(text)));
  const weight = source === "chats" ? 3 : source === "notes" ? 2 : 1;

  for (const candidate of candidates) {
    const stats =
      statsByTopic.get(candidate) ??
      {
        topic: titleCaseTopic(candidate),
        chats: 0,
        notes: 0,
        quizzes: 0,
        score: 0,
      };

    stats[source] += 1;
    stats.score += weight;
    statsByTopic.set(candidate, stats);
  }
}

function removeSubtopicDuplicates(signals: WeaknessHeuristicSignal[]) {
  return signals.filter(
    (candidate) => {
      const candidateWordCount = candidate.topic.split(" ").length;

      return !signals.some(
        (other) =>
          other !== candidate &&
          other.topic.toLowerCase().includes(candidate.topic.toLowerCase()) &&
          (other.score > candidate.score ||
            (candidateWordCount === 1 && other.score >= candidate.score)),
      );
    },
  );
}

export function buildWeaknessHeuristicSignals(
  activity: WeaknessDetectionActivity,
): WeaknessHeuristicSignal[] {
  const statsByTopic = new Map<string, WeaknessHeuristicSignal>();

  for (const chat of activity.recentChats) {
    addSignals(statsByTopic, "chats", [chat.excerpt]);
  }

  for (const note of activity.recentNotes) {
    addSignals(statsByTopic, "notes", [note.title ?? "", note.excerpt]);
  }

  for (const quiz of activity.recentQuizzes) {
    addSignals(statsByTopic, "quizzes", [quiz.title ?? ""]);
    addSignals(statsByTopic, "quizzes", quiz.excerpts);
  }

  return removeSubtopicDuplicates([...statsByTopic.values()])
    .sort((first, second) => {
      if (second.score !== first.score) {
        return second.score - first.score;
      }

      return first.topic.localeCompare(second.topic);
    })
    .slice(0, 10);
}

function formatActivity(activity: WeaknessDetectionActivity) {
  return [
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
  ].join("\n");
}

function formatHeuristicSignals(signals: WeaknessHeuristicSignal[]) {
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

function normalizeConfidence(value: unknown): WeaknessConfidence {
  if (value === "High" || value === "Medium" || value === "Low") {
    return value;
  }

  return "Low";
}

function normalizeWeakTopic(value: unknown): WeakTopic | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, unknown>;

  if (
    typeof candidate.topic !== "string" ||
    typeof candidate.reason !== "string" ||
    typeof candidate.suggestedAction !== "string"
  ) {
    return null;
  }

  const topic = candidate.topic.trim();
  const reason = candidate.reason.trim();
  const suggestedAction = candidate.suggestedAction.trim();

  if (!topic || !reason || !suggestedAction) {
    return null;
  }

  return {
    topic,
    confidence: normalizeConfidence(candidate.confidence),
    reason,
    suggestedAction,
  };
}

function parseWeakTopics(content: string): WeakTopic[] {
  const parsed = JSON.parse(content) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error("Weakness response must be a JSON array.");
  }

  return parsed.map(normalizeWeakTopic).filter(Boolean).slice(0, 3) as WeakTopic[];
}

export function hasWeaknessActivity(activity: WeaknessDetectionActivity) {
  return (
    activity.recentChats.length > 0 ||
    activity.recentNotes.length > 0 ||
    activity.recentQuizzes.length > 0
  );
}

export function buildQuizExcerpts(quizJson: unknown) {
  return normalizeStoredStudyQuizPayload(quizJson)
    .flatMap((question) => [question.question, question.explanation])
    .map((content) => getExcerpt(content, 140))
    .slice(0, 6);
}

export async function generateWeaknessDetection(
  activity: WeaknessDetectionActivity,
) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const model = process.env.OPENAI_MODEL || DEFAULT_WEAKNESS_MODEL;
  const client = createOpenAiClient(apiKey);
  const heuristicSignals = buildWeaknessHeuristicSignals(activity);
  let completion: OpenAI.Chat.Completions.ChatCompletion;

  try {
    completion = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: [
            "Detect likely weak study topics from recent user study activity.",
            "Use only the supplied chats, notes, quizzes, and heuristic signals.",
            "Return JSON only. Do not invent facts or topics not supported by the activity.",
          ].join(" "),
        },
        {
          role: "user",
          content: [
            "Return at most 3 weak topics as a JSON array.",
            "",
            "Each item must have:",
            "- topic: short specific topic name",
            "- confidence: High, Medium, or Low",
            "- reason: one concise sentence grounded in the activity",
            "- suggestedAction: one concrete study action",
            "",
            "Prefer topics that appear across repeated questions, notes, quiz questions, uncertainty language, or heuristic signals.",
            "",
            "Recent study activity:",
            formatActivity(activity),
            "",
            "Lightweight heuristic signals:",
            formatHeuristicSignals(heuristicSignals),
          ].join("\n"),
        },
      ],
    });
  } catch (error) {
    throw new Error(`OpenAI weakness request failed: ${getErrorMessage(error)}`);
  }

  const content = completion.choices[0]?.message?.content?.trim() ?? "";

  if (!content) {
    throw new Error("OpenAI weakness response did not include JSON content.");
  }

  try {
    return parseWeakTopics(content);
  } catch (error) {
    throw new Error(`Unable to parse weakness response: ${getErrorMessage(error)}`);
  }
}
