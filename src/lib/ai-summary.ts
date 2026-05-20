import OpenAI from "openai";
import { fetch as undiciFetch, ProxyAgent } from "undici";

const DEFAULT_SUMMARY_MODEL = "gpt-4o-mini";
type FetchInitWithDispatcher = RequestInit & {
  dispatcher?: ProxyAgent;
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
    fetch: proxyUrl ? createProxyFetch(proxyUrl) : undefined,
  });
}

export async function generateDocumentSummary(rawText: string) {
  const documentText = rawText.trim();

  if (!documentText) {
    throw new Error("Cannot generate AI summary for empty document text.");
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const model = process.env.OPENAI_MODEL || DEFAULT_SUMMARY_MODEL;
  const client = createOpenAiClient(apiKey);
  let summaryResponse: OpenAI.Chat.Completions.ChatCompletion;

  try {
    summaryResponse = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content:
            "Summarize study documents using only information present in the document text.",
        },
        {
          role: "user",
          content: [
            "Return 3-6 short bullet points or a short paragraph.",
            "",
            "Document text:",
            documentText,
          ].join("\n"),
        },
      ],
    });
  } catch (error) {
    throw new Error(`OpenAI summary request failed: ${getErrorMessage(error)}`);
  }

  const summary = summaryResponse.choices[0]?.message?.content?.trim() ?? "";

  if (!summary) {
    throw new Error("OpenAI summary response did not include summary text.");
  }

  return summary;
}
