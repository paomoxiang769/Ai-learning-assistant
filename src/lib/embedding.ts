import OpenAI from "openai";
import { fetch as undiciFetch, ProxyAgent } from "undici";

const EMBEDDING_MODEL = "text-embedding-3-small";

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
    fetch: proxyUrl
      ? createProxyFetch(proxyUrl)
      : globalThis.fetch.bind(globalThis),
  });
}

export async function generateEmbedding(text: string) {
  const trimmedText = text.trim();

  if (!trimmedText) {
    throw new Error("Cannot generate embedding for empty text.");
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const client = createOpenAiClient(apiKey);
  let embeddingResponse: OpenAI.Embeddings.CreateEmbeddingResponse;

  try {
    embeddingResponse = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: trimmedText,
      encoding_format: "float",
    });
  } catch (error) {
    throw new Error(`OpenAI embedding request failed: ${getErrorMessage(error)}`);
  }

  const embedding = embeddingResponse.data[0]?.embedding;

  if (!embedding || embedding.length === 0) {
    throw new Error("OpenAI embedding response did not include embedding data.");
  }

  return embedding;
}
