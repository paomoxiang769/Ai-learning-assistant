import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_QUIZ_MODEL,
  generateStudyQuiz,
} from "../src/lib/study-quiz.ts";
import { createStudyQuizRoute } from "../src/lib/study-quiz-route.ts";

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

test("generateStudyQuiz sends document text to the configured OpenAI-compatible API and returns validated quiz items", async () => {
  process.env.OPENAI_API_KEY = "test-api-key";
  process.env.OPENAI_BASE_URL = "https://compatible.example/v1";
  process.env.OPENAI_MODEL = "test-quiz-model";
  delete process.env.HTTPS_PROXY;
  delete process.env.HTTP_PROXY;

  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(String(init?.body));
    const requestUrl =
      typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;

    assert.equal(requestUrl, "https://compatible.example/v1/chat/completions");
    assert.equal(init?.method, "POST");
    assert.equal(body.model, "test-quiz-model");
    assert.match(body.messages[0].content, /Generate study quiz questions/i);
    assert.match(body.messages.at(-1).content, /Count: 5/);
    assert.match(body.messages.at(-1).content, /Binary search halves the search space/i);
    assert.match(body.messages.at(-1).content, /multiple choice/i);
    assert.match(body.messages.at(-1).content, /short answer/i);

    return new Response(
      JSON.stringify({
        id: "chatcmpl-test",
        object: "chat.completion",
        created: 0,
        model: "test-quiz-model",
        choices: [
          {
            index: 0,
            finish_reason: "stop",
            message: {
              role: "assistant",
              content: JSON.stringify([
                {
                  question: "What does binary search do on each step?",
                  type: "multiple choice",
                  options: [
                    "It halves the search space.",
                    "It sorts the array from scratch.",
                    "It scans every element in order.",
                    "It builds a hash table first.",
                  ],
                  answer: "It halves the search space.",
                  explanation:
                    "Binary search compares against the middle element and discards half of the remaining candidates.",
                },
                {
                  question: "Why must the input be sorted before binary search?",
                  type: "short answer",
                  answer:
                    "Because the algorithm relies on ordered values to decide which half can be discarded.",
                  explanation:
                    "Without sorted order, comparing against the middle element gives no reliable direction.",
                },
              ]),
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

  const result = await generateStudyQuiz(
    "Binary search halves the search space by comparing the target with the middle element of a sorted array.",
    { count: 5 },
  );

  assert.deepEqual(result, [
    {
      question: "What does binary search do on each step?",
      type: "multiple choice",
      options: [
        "It halves the search space.",
        "It sorts the array from scratch.",
        "It scans every element in order.",
        "It builds a hash table first.",
      ],
      answer: "It halves the search space.",
      explanation:
        "Binary search compares against the middle element and discards half of the remaining candidates.",
    },
    {
      question: "Why must the input be sorted before binary search?",
      type: "short answer",
      answer:
        "Because the algorithm relies on ordered values to decide which half can be discarded.",
      explanation:
        "Without sorted order, comparing against the middle element gives no reliable direction.",
    },
  ]);
});

test("generateStudyQuiz defaults OPENAI_MODEL to the quiz default", async () => {
  process.env.OPENAI_API_KEY = "test-api-key";
  process.env.OPENAI_BASE_URL = "https://compatible.example/v1";
  delete process.env.OPENAI_MODEL;
  delete process.env.HTTPS_PROXY;
  delete process.env.HTTP_PROXY;

  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body));

    assert.equal(body.model, DEFAULT_QUIZ_MODEL);

    return new Response(
      JSON.stringify({
        id: "chatcmpl-test",
        object: "chat.completion",
        created: 0,
        model: DEFAULT_QUIZ_MODEL,
        choices: [
          {
            index: 0,
            finish_reason: "stop",
            message: {
              role: "assistant",
              content: JSON.stringify([
                {
                  question: "What is a stack?",
                  type: "short answer",
                  answer: "A LIFO data structure.",
                  explanation: "Elements are added and removed from the same end.",
                },
              ]),
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

  const result = await generateStudyQuiz("Stack notes", { count: 1 });

  assert.equal(result[0]?.question, "What is a stack?");
});

test("study quiz route validates access, loads document text, and returns generated quiz items", async () => {
  let capturedCall = null;
  const operations = [];

  const handler = createStudyQuizRoute({
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
      from(table) {
        assert.equal(table, "documents");

        return {
          select(columns) {
            operations.push(["documents.select", columns]);
            return this;
          },
          eq(column, value) {
            operations.push(["documents.eq", column, value]);
            return this;
          },
          maybeSingle() {
            return {
              data: {
                id: "document-9",
                file_name: "Algorithms Notes",
                raw_text: "Binary search uses a sorted array.",
                processing_status: "completed",
              },
              error: null,
            };
          },
        };
      },
    }),
    generateQuiz: async (documentText, options) => {
      capturedCall = { documentText, options };

      return [
        {
          question: "What does binary search require?",
          type: "short answer",
          answer: "A sorted array.",
          explanation: "It relies on order to eliminate half the search space.",
        },
      ];
    },
  });

  const response = await handler(
    new Request("http://localhost/api/study/quiz", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        documentId: "document-9",
        count: 5,
      }),
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(capturedCall, {
    documentText: "Binary search uses a sorted array.",
    options: {
      count: 5,
      documentTitle: "Algorithms Notes",
    },
  });
  assert.deepEqual(operations, [
    ["documents.select", "id, file_name, raw_text, processing_status"],
    ["documents.eq", "id", "document-9"],
    ["documents.eq", "user_id", "user-1"],
  ]);
  assert.deepEqual(await response.json(), [
    {
      question: "What does binary search require?",
      type: "short answer",
      answer: "A sorted array.",
      explanation: "It relies on order to eliminate half the search space.",
    },
  ]);
});

test("study quiz route rejects invalid quiz counts", async () => {
  const handler = createStudyQuizRoute({
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
      from() {
        throw new Error("from() should not be called for invalid requests");
      },
    }),
    generateQuiz: async () => {
      throw new Error("generateQuiz should not be called for invalid requests");
    },
  });

  const response = await handler(
    new Request("http://localhost/api/study/quiz", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        documentId: "document-9",
        count: 0,
      }),
    }),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "count must be a positive number.",
  });
});
