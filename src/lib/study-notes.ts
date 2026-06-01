import OpenAI from "openai";
import { fetch as undiciFetch, ProxyAgent } from "undici";

export const DEFAULT_STUDY_NOTES_MODEL = "gpt-4o-mini";

type FetchInitWithDispatcher = RequestInit & {
  dispatcher?: ProxyAgent;
};

type GenerateStudyNotesOptions = {
  documentTitle?: string;
  summary?: string | null;
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

export async function generateStudyNotes(
  documentText: string,
  options: GenerateStudyNotesOptions = {},
) {
  const trimmedDocumentText = documentText.trim();

  if (!trimmedDocumentText) {
    throw new Error("Cannot generate study notes for empty document text.");
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const model = process.env.OPENAI_MODEL || DEFAULT_STUDY_NOTES_MODEL;
  const client = createOpenAiClient(apiKey);
  const summary = options.summary?.trim();
  let completion: OpenAI.Chat.Completions.ChatCompletion;

  try {
    completion = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content:
            "Create concise study notes using only information present in the provided document text and summary.",
        },
        {
          role: "user",
          content: [
            "Return Study Notes with these sections:",
            "- Key concepts",
            "- Important definitions",
            "- Short bullet summary",
            "",
            "Use concise markdown-style headings and bullets.",
            options.documentTitle ? `Document title: ${options.documentTitle}` : null,
            summary ? ["", "Existing summary:", summary].join("\n") : null,
            "",
            "Raw document text:",
            trimmedDocumentText,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    });
  } catch (error) {
    throw new Error(`OpenAI study notes request failed: ${getErrorMessage(error)}`);
  }

  const notes = completion.choices[0]?.message?.content?.trim() ?? "";

  if (!notes) {
    throw new Error("OpenAI study notes response did not include note content.");
  }

  return notes;
}

export type { GenerateStudyNotesOptions };
