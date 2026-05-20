import assert from "node:assert/strict";
import test from "node:test";
import { generateDocumentSummary } from "../src/lib/ai-summary.ts";

const originalFetch = globalThis.fetch;
const originalOpenAiApiKey = process.env.OPENAI_API_KEY;
const originalOpenAiBaseUrl = process.env.OPENAI_BASE_URL;
const originalOpenAiModel = process.env.OPENAI_MODEL;
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

  if (originalOpenAiModel === undefined) {
    delete process.env.OPENAI_MODEL;
  } else {
    process.env.OPENAI_MODEL = originalOpenAiModel;
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

test("generateDocumentSummary sends raw text to the configured OpenAI-compatible API", async () => {
  process.env.OPENAI_API_KEY = "test-api-key";
  process.env.OPENAI_BASE_URL = "https://compatible.example/v1";
  process.env.OPENAI_MODEL = "test-summary-model";

  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(String(init?.body));
    const requestUrl =
      typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;

    assert.equal(requestUrl, "https://compatible.example/v1/chat/completions");
    assert.equal(init?.method, "POST");
    assert.equal(body.model, "test-summary-model");
    assert.match(body.messages.at(-1).content, /Important lesson text/);

    return new Response(
      JSON.stringify({
        id: "chatcmpl-test",
        object: "chat.completion",
        created: 0,
        model: "test-summary-model",
        choices: [
          {
            index: 0,
            finish_reason: "stop",
            message: { role: "assistant", content: "Concise AI summary." },
          },
        ],
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  };

  const summary = await generateDocumentSummary("Important lesson text");

  assert.equal(summary, "Concise AI summary.");
});

test("generateDocumentSummary defaults OPENAI_MODEL to gpt-4o-mini", async () => {
  process.env.OPENAI_API_KEY = "test-api-key";
  process.env.OPENAI_BASE_URL = "https://compatible.example/v1";
  delete process.env.OPENAI_MODEL;

  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(String(init?.body));

    assert.equal(body.model, "gpt-4o-mini");

    return new Response(
      JSON.stringify({
        id: "chatcmpl-test",
        object: "chat.completion",
        created: 0,
        model: "gpt-4o-mini",
        choices: [
          {
            index: 0,
            finish_reason: "stop",
            message: { role: "assistant", content: "Default model summary." },
          },
        ],
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  };

  const summary = await generateDocumentSummary("Important lesson text");

  assert.equal(summary, "Default model summary.");
});

test("generateDocumentSummary does not add a dispatcher when no proxy is configured", async () => {
  process.env.OPENAI_API_KEY = "test-api-key";
  process.env.OPENAI_BASE_URL = "https://compatible.example/v1";
  process.env.OPENAI_MODEL = "test-summary-model";
  delete process.env.HTTPS_PROXY;
  delete process.env.HTTP_PROXY;

  globalThis.fetch = async (url, init) => {
    assert.equal(init?.dispatcher, undefined);

    return new Response(
      JSON.stringify({
        id: "chatcmpl-test",
        object: "chat.completion",
        created: 0,
        model: "test-summary-model",
        choices: [
          {
            index: 0,
            finish_reason: "stop",
            message: { role: "assistant", content: "No proxy summary." },
          },
        ],
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  };

  const summary = await generateDocumentSummary("Important lesson text");

  assert.equal(summary, "No proxy summary.");
});

test("generateDocumentSummary rejects empty raw text", async () => {
  process.env.OPENAI_API_KEY = "test-api-key";

  await assert.rejects(
    () => generateDocumentSummary("  \n\t  "),
    /Cannot generate AI summary for empty document text/,
  );
});

test("generateDocumentSummary rejects when OPENAI_API_KEY is missing", async () => {
  delete process.env.OPENAI_API_KEY;

  await assert.rejects(
    () => generateDocumentSummary("Some document text"),
    /OPENAI_API_KEY is not configured/,
  );
});

test("generateDocumentSummary surfaces OpenAI API errors", async () => {
  process.env.OPENAI_API_KEY = "test-api-key";
  process.env.OPENAI_BASE_URL = "https://compatible.example/v1";

  globalThis.fetch = async () =>
    new Response(JSON.stringify({ error: { message: "Invalid API key" } }), {
      status: 401,
      statusText: "Unauthorized",
      headers: { "content-type": "application/json" },
    });

  await assert.rejects(
    () => generateDocumentSummary("Some document text"),
    /OpenAI summary request failed:.*Invalid API key/,
  );
});
