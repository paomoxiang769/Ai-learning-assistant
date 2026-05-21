import assert from "node:assert/strict";
import test from "node:test";
import { generateEmbedding } from "../src/lib/embedding.ts";

const originalFetch = globalThis.fetch;
const originalOpenAiApiKey = process.env.OPENAI_API_KEY;
const originalOpenAiBaseUrl = process.env.OPENAI_BASE_URL;
const originalHttpsProxy = process.env.HTTPS_PROXY;
const originalHttpProxy = process.env.HTTP_PROXY;

function restoreEnvironment() {
  globalThis.fetch = originalFetch;

  if (originalOpenAiApiKey === undefined) {
    delete process.env.OPENAI_API_KEY;
  } else {
    process.env.OPENAI_API_KEY = originalOpenAiApiKey;
  }

  if (originalOpenAiBaseUrl === undefined) {
    delete process.env.OPENAI_BASE_URL;
  } else {
    process.env.OPENAI_BASE_URL = originalOpenAiBaseUrl;
  }

  if (originalHttpsProxy === undefined) {
    delete process.env.HTTPS_PROXY;
  } else {
    process.env.HTTPS_PROXY = originalHttpsProxy;
  }

  if (originalHttpProxy === undefined) {
    delete process.env.HTTP_PROXY;
  } else {
    process.env.HTTP_PROXY = originalHttpProxy;
  }
}

test.afterEach(() => {
  restoreEnvironment();
});

test("generateEmbedding sends text to the configured OpenAI-compatible API", async () => {
  process.env.OPENAI_API_KEY = "test-api-key";
  process.env.OPENAI_BASE_URL = "https://compatible.example/v1";
  delete process.env.HTTPS_PROXY;
  delete process.env.HTTP_PROXY;

  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(String(init?.body));
    const requestUrl =
      typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;

    assert.equal(requestUrl, "https://compatible.example/v1/embeddings");
    assert.equal(init?.method, "POST");
    assert.equal(body.model, "text-embedding-3-small");
    assert.equal(body.input, "Important lesson text");

    return new Response(
      JSON.stringify({
        object: "list",
        data: [
          {
            object: "embedding",
            index: 0,
            embedding: [0.1, 0.2, 0.3],
          },
        ],
        model: "text-embedding-3-small",
        usage: {
          prompt_tokens: 3,
          total_tokens: 3,
        },
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  };

  const embedding = await generateEmbedding("Important lesson text");

  assert.deepEqual(embedding, [0.1, 0.2, 0.3]);
});

test("generateEmbedding does not add a dispatcher when no proxy is configured", async () => {
  process.env.OPENAI_API_KEY = "test-api-key";
  process.env.OPENAI_BASE_URL = "https://compatible.example/v1";
  delete process.env.HTTPS_PROXY;
  delete process.env.HTTP_PROXY;

  globalThis.fetch = async (url, init) => {
    assert.equal(init?.dispatcher, undefined);

    return new Response(
      JSON.stringify({
        object: "list",
        data: [
          {
            object: "embedding",
            index: 0,
            embedding: [0.1],
          },
        ],
        model: "text-embedding-3-small",
        usage: {
          prompt_tokens: 1,
          total_tokens: 1,
        },
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  };

  const embedding = await generateEmbedding("Important lesson text");

  assert.deepEqual(embedding, [0.1]);
});

test("generateEmbedding rejects empty text", async () => {
  process.env.OPENAI_API_KEY = "test-api-key";

  await assert.rejects(
    () => generateEmbedding("  \n\t  "),
    /Cannot generate embedding for empty text/,
  );
});

test("generateEmbedding rejects when OPENAI_API_KEY is missing", async () => {
  delete process.env.OPENAI_API_KEY;

  await assert.rejects(
    () => generateEmbedding("Some document text"),
    /OPENAI_API_KEY is not configured/,
  );
});

test("generateEmbedding surfaces OpenAI API errors", async () => {
  process.env.OPENAI_API_KEY = "test-api-key";
  process.env.OPENAI_BASE_URL = "https://compatible.example/v1";
  delete process.env.HTTPS_PROXY;
  delete process.env.HTTP_PROXY;

  globalThis.fetch = async () =>
    new Response(JSON.stringify({ error: { message: "Invalid API key" } }), {
      status: 401,
      statusText: "Unauthorized",
      headers: { "content-type": "application/json" },
    });

  await assert.rejects(
    () => generateEmbedding("Some document text"),
    /OpenAI embedding request failed:.*Invalid API key/,
  );
});
