import assert from "node:assert/strict";
import test from "node:test";
import {
  createRagAnswerGenerator,
  MATERIAL_DOES_NOT_MENTION_IT_MESSAGE,
} from "../src/lib/rag-answer.ts";
import { createRagAnswerRoute } from "../src/app/api/rag/answer/route.ts";

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

test("answerQuestion retrieves chunks and sends grounded context plus history to the configured OpenAI-compatible API", async () => {
  process.env.OPENAI_API_KEY = "test-api-key";
  process.env.OPENAI_BASE_URL = "https://compatible.example/v1";
  process.env.OPENAI_MODEL = "test-answer-model";
  delete process.env.HTTPS_PROXY;
  delete process.env.HTTP_PROXY;

  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(String(init?.body));
    const requestUrl =
      typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;

    assert.equal(requestUrl, "https://compatible.example/v1/chat/completions");
    assert.equal(init?.method, "POST");
    assert.equal(body.model, "test-answer-model");
    assert.match(body.messages[0].content, /only the provided document chunks/i);
    assert.match(body.messages[0].content, /history can be used to resolve references/i);
    assert.match(body.messages[0].content, /compare the current chunks with the prior topic/i);
    assert.match(
      body.messages[0].content,
      /reply with exactly: "The material does not mention it." only when the history and chunks together cannot support the answer/i,
    );
    assert.equal(body.messages[1].role, "user");
    assert.equal(body.messages[1].content, "Earlier question");
    assert.equal(body.messages[2].role, "assistant");
    assert.equal(body.messages[2].content, "Earlier answer");
    assert.match(body.messages.at(-1).content, /Current question: What is kinetic energy\?/);
    assert.match(body.messages.at(-1).content, /Chunk 0/);
    assert.match(body.messages.at(-1).content, /Kinetic energy is the energy of motion/);
    assert.match(body.messages.at(-1).content, /Chunk 1/);

    return new Response(
      JSON.stringify({
        id: "chatcmpl-test",
        object: "chat.completion",
        created: 0,
        model: "test-answer-model",
        choices: [
          {
            index: 0,
            finish_reason: "stop",
            message: {
              role: "assistant",
              content: "Kinetic energy is the energy of motion.",
            },
          },
        ],
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  };

  const answerQuestion = createRagAnswerGenerator({
    retrieveRelevantChunks: async () => [
      {
        id: "chunk-0",
        documentId: "document-1",
        chunkIndex: 0,
        content: "Kinetic energy is the energy of motion.",
        similarity: 0.94,
      },
      {
        id: "chunk-1",
        documentId: "document-1",
        chunkIndex: 1,
        content: "It depends on mass and velocity.",
        similarity: 0.81,
      },
    ],
  });

  const result = await answerQuestion("What is kinetic energy?", {
    documentId: "document-1",
    topK: 2,
    history: [
      { role: "user", content: "Earlier question" },
      { role: "assistant", content: "Earlier answer" },
    ],
  });

  assert.equal(result.answer, "Kinetic energy is the energy of motion.");
  assert.equal(result.chunks.length, 2);
});

test("answerQuestion prompt supports follow-up comparison questions grounded by history plus current chunks", async () => {
  process.env.OPENAI_API_KEY = "test-api-key";
  process.env.OPENAI_BASE_URL = "https://compatible.example/v1";
  process.env.OPENAI_MODEL = "test-answer-model";
  delete process.env.HTTPS_PROXY;
  delete process.env.HTTP_PROXY;

  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body));

    assert.equal(body.messages[1].role, "user");
    assert.equal(body.messages[1].content, "What is KMP algorithm?");
    assert.equal(body.messages[2].role, "assistant");
    assert.equal(body.messages[2].content, "KMP matches patterns by reusing prefix information.");
    assert.match(body.messages.at(-1).content, /How is it different from Rabin-Karp\?/);
    assert.match(body.messages.at(-1).content, /Rabin-Karp uses hashing/);

    return new Response(
      JSON.stringify({
        id: "chatcmpl-test",
        object: "chat.completion",
        created: 0,
        model: "test-answer-model",
        choices: [
          {
            index: 0,
            finish_reason: "stop",
            message: {
              role: "assistant",
              content:
                "KMP reuses prefix information, while Rabin-Karp uses hashing to compare candidate matches.",
            },
          },
        ],
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  };

  const answerQuestion = createRagAnswerGenerator({
    retrieveRelevantChunks: async () => [
      {
        id: "chunk-rk",
        documentId: "document-1",
        chunkIndex: 4,
        content: "Rabin-Karp uses hashing to compare candidate substring matches.",
        similarity: 0.9,
      },
    ],
  });

  const result = await answerQuestion("How is it different from Rabin-Karp?", {
    documentId: "document-1",
    history: [
      { role: "user", content: "What is KMP algorithm?" },
      {
        role: "assistant",
        content: "KMP matches patterns by reusing prefix information.",
      },
    ],
  });

  assert.match(result.answer, /Rabin-Karp uses hashing/i);
  assert.equal(result.chunks.length, 1);
});

test("answerQuestion returns the fallback message when no relevant chunks are found", async () => {
  let fetchCalled = false;
  globalThis.fetch = async () => {
    fetchCalled = true;
    throw new Error("fetch should not be called");
  };

  const answerQuestion = createRagAnswerGenerator({
    retrieveRelevantChunks: async () => [],
  });

  const result = await answerQuestion("What is kinetic energy?");

  assert.equal(result.answer, MATERIAL_DOES_NOT_MENTION_IT_MESSAGE);
  assert.deepEqual(result.chunks, []);
  assert.equal(fetchCalled, false);
});

test("RAG answer route validates the request body and forwards question plus history to the answer pipeline", async () => {
  let capturedCall = null;
  const handler = createRagAnswerRoute({
    createClient: async () => ({
      auth: {
        async getUser() {
          return {
            data: {
              user: { id: "user-1" },
            },
          };
        },
      },
    }),
    answerQuestion: async (question, options) => {
      capturedCall = { question, options };

      return {
        answer: "Grounded answer.",
        chunks: [
          {
            id: "chunk-5",
            documentId: "document-9",
            chunkIndex: 5,
            content: "Grounding chunk content.",
            similarity: 0.88,
          },
        ],
      };
    },
  });

  const request = new Request("http://localhost/api/rag/answer", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      question: "Explain the concept",
      documentId: "document-9",
      topK: 3,
      history: [
        { role: "user", content: "First turn" },
        { role: "assistant", content: "First answer" },
      ],
    }),
  });

  const response = await handler(request);

  assert.equal(response.status, 200);
  assert.deepEqual(capturedCall, {
    question: "Explain the concept",
    options: {
      documentId: "document-9",
      topK: 3,
      history: [
        { role: "user", content: "First turn" },
        { role: "assistant", content: "First answer" },
      ],
    },
  });
  assert.deepEqual(await response.json(), {
    answer: "Grounded answer.",
    chunks: [
      {
        id: "chunk-5",
        documentId: "document-9",
        chunkIndex: 5,
        content: "Grounding chunk content.",
        similarity: 0.88,
      },
    ],
  });
});
