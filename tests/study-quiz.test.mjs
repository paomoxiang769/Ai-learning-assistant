import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_QUIZ_MODEL,
  generateStudyQuiz,
} from "../src/lib/study-quiz.ts";
import { createStudyQuizRoute } from "../src/lib/study-quiz-route.ts";

const sampleQuiz = [
  {
    question: "What does binary search require?",
    type: "short answer",
    answer: "A sorted array.",
    explanation: "It relies on order to eliminate half the search space.",
  },
];

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

test("generateStudyQuiz includes variation guidance and avoid questions in the prompt", async () => {
  process.env.OPENAI_API_KEY = "test-api-key";
  process.env.OPENAI_BASE_URL = "https://compatible.example/v1";
  process.env.OPENAI_MODEL = "test-quiz-model";
  delete process.env.HTTPS_PROXY;
  delete process.env.HTTP_PROXY;
  let capturedPrompt = "";

  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    capturedPrompt = body.messages.at(-1).content;

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
                  question: "How would binary search behave on a reversed array?",
                  type: "short answer",
                  answer: "It would not work reliably unless the order assumption is adjusted.",
                  explanation:
                    "Binary search needs a consistent ordering rule to decide which side to discard.",
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

  const result = await generateStudyQuiz("Binary search notes", {
    count: 1,
    avoidQuestions: ["What does binary search require?"],
  });

  assert.equal(result[0]?.question, "How would binary search behave on a reversed array?");
  assert.match(capturedPrompt, /Generate a fresh quiz/i);
  assert.match(capturedPrompt, /Avoid repeating these existing questions/i);
  assert.match(capturedPrompt, /What does binary search require\?/);
  assert.match(capturedPrompt, /concept understanding/i);
  assert.match(capturedPrompt, /comparison/i);
  assert.match(capturedPrompt, /application/i);
  assert.match(capturedPrompt, /short answer/i);
  assert.match(capturedPrompt, /multiple choice/i);
});

test("generateStudyQuiz accepts wrapped quiz JSON returned by the model", async () => {
  process.env.OPENAI_API_KEY = "test-api-key";
  process.env.OPENAI_BASE_URL = "https://compatible.example/v1";
  process.env.OPENAI_MODEL = "test-quiz-model";
  delete process.env.HTTPS_PROXY;
  delete process.env.HTTP_PROXY;

  globalThis.fetch = async () =>
    new Response(
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
              content: JSON.stringify({
                questions: [
                  {
                    question: "How can binary search be used in an application?",
                    type: "short answer",
                    answer: "It can find a target or boundary in sorted data.",
                    explanation:
                      "The method repeatedly halves the candidate range by using sorted order.",
                  },
                ],
              }),
            },
          },
        ],
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );

  const result = await generateStudyQuiz("Binary search notes", { count: 1 });

  assert.deepEqual(result, [
    {
      question: "How can binary search be used in an application?",
      type: "short answer",
      answer: "It can find a target or boundary in sorted data.",
      explanation:
        "The method repeatedly halves the candidate range by using sorted order.",
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

  const { POST } = createStudyQuizRoute({
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

      return sampleQuiz;
    },
  });

  const response = await POST(
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

test("study quiz route keeps save false requests temporary and does not insert quizzes", async () => {
  const operations = [];
  const { POST } = createStudyQuizRoute({
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
        operations.push(["from", table]);

        if (table !== "documents") {
          throw new Error(`Unexpected table: ${table}`);
        }

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
    generateQuiz: async () => sampleQuiz,
  });

  const response = await POST(
    new Request("http://localhost/api/study/quiz", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        documentId: "document-9",
        count: 5,
        save: false,
      }),
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), sampleQuiz);
  assert.equal(
    operations.some((operation) => operation[1] === "document_quizzes"),
    false,
  );
});

test("study quiz route saves generated quizzes when save is true", async () => {
  const operations = [];
  let capturedCall = null;
  const { POST } = createStudyQuizRoute({
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
        operations.push(["from", table]);

        if (table === "documents") {
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
        }

        if (table === "document_quizzes") {
          return {
            eq(column, value) {
              operations.push(["quizzes.eq", column, value]);
              return this;
            },
            insert(payload) {
              operations.push(["quizzes.insert", payload]);
              return this;
            },
            order(column, options) {
              operations.push(["quizzes.order", column, options]);
              return {
                data: [],
                error: null,
              };
            },
            select(columns) {
              operations.push(["quizzes.select", columns]);
              return this;
            },
            single() {
              return {
                data: {
                  id: "quiz-1",
                },
                error: null,
              };
            },
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      },
    }),
    generateQuiz: async (documentText, options) => {
      capturedCall = { documentText, options };

      return sampleQuiz;
    },
  });

  const response = await POST(
    new Request("http://localhost/api/study/quiz", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        documentId: "document-9",
        count: 5,
        save: true,
      }),
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    quizId: "quiz-1",
    quiz: sampleQuiz,
  });
  assert.deepEqual(capturedCall, {
    documentText: "Binary search uses a sorted array.",
    options: {
      count: 5,
      documentTitle: "Algorithms Notes",
      avoidQuestions: [],
    },
  });
  assert.deepEqual(
    operations.filter(([name]) => name === "quizzes.insert"),
    [
      [
        "quizzes.insert",
        {
          document_id: "document-9",
          user_id: "user-1",
          title: null,
          quiz_json: sampleQuiz,
        },
      ],
    ],
  );
});

test("study quiz route passes saved quiz questions as an avoid list when saving a new quiz", async () => {
  let capturedCall = null;
  const { POST } = createStudyQuizRoute({
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
        if (table === "documents") {
          return {
            select() {
              return this;
            },
            eq() {
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
        }

        if (table === "document_quizzes") {
          return {
            eq() {
              return this;
            },
            insert() {
              return this;
            },
            order() {
              return {
                data: [
                  {
                    quiz_json: [
                      {
                        question: "What does binary search require?",
                        type: "short answer",
                        answer: "A sorted array.",
                        explanation: "Binary search relies on order.",
                      },
                    ],
                  },
                ],
                error: null,
              };
            },
            select() {
              return this;
            },
            single() {
              return {
                data: {
                  id: "quiz-2",
                },
                error: null,
              };
            },
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      },
    }),
    generateQuiz: async (documentText, options) => {
      capturedCall = { documentText, options };

      return [
        {
          question: "How can binary search be applied to find a boundary?",
          type: "short answer",
          answer: "Search for the first position where a condition changes.",
          explanation:
            "Binary search can locate boundaries in monotonic true/false spaces.",
        },
      ];
    },
  });

  const response = await POST(
    new Request("http://localhost/api/study/quiz", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        documentId: "document-9",
        count: 5,
        save: true,
      }),
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(capturedCall, {
    documentText: "Binary search uses a sorted array.",
    options: {
      count: 5,
      documentTitle: "Algorithms Notes",
      avoidQuestions: ["What does binary search require?"],
    },
  });
});

test("study quiz route tolerates wrapped saved quiz JSON when building the avoid list", async () => {
  let capturedCall = null;
  const { POST } = createStudyQuizRoute({
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
        if (table === "documents") {
          return {
            select() {
              return this;
            },
            eq() {
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
        }

        if (table === "document_quizzes") {
          return {
            eq() {
              return this;
            },
            insert() {
              return this;
            },
            order() {
              return {
                data: [
                  {
                    quiz_json: {
                      quiz: [
                        {
                          question: "Why does binary search need ordering?",
                          type: "short answer",
                          answer: "Ordering makes it possible to discard one side.",
                          explanation:
                            "The midpoint comparison only gives direction in ordered data.",
                        },
                      ],
                    },
                  },
                ],
                error: null,
              };
            },
            select() {
              return this;
            },
            single() {
              return {
                data: {
                  id: "quiz-3",
                },
                error: null,
              };
            },
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      },
    }),
    generateQuiz: async (documentText, options) => {
      capturedCall = { documentText, options };

      return sampleQuiz;
    },
  });

  const response = await POST(
    new Request("http://localhost/api/study/quiz", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        documentId: "document-9",
        count: 5,
        save: true,
      }),
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(capturedCall, {
    documentText: "Binary search uses a sorted array.",
    options: {
      count: 5,
      documentTitle: "Algorithms Notes",
      avoidQuestions: ["Why does binary search need ordering?"],
    },
  });
});

test("study quiz GET returns current user saved quizzes", async () => {
  const operations = [];
  const { GET } = createStudyQuizRoute({
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
        assert.equal(table, "document_quizzes");

        return {
          select(columns) {
            operations.push(["quizzes.select", columns]);
            return this;
          },
          eq(column, value) {
            operations.push(["quizzes.eq", column, value]);
            return this;
          },
          order(column, options) {
            operations.push(["quizzes.order", column, options]);
            return {
              data: [
                {
                  id: "quiz-1",
                  document_id: "document-9",
                  title: null,
                  quiz_json: sampleQuiz,
                  created_at: "2026-05-29T06:00:00.000Z",
                },
              ],
              error: null,
            };
          },
        };
      },
    }),
    generateQuiz: async () => {
      throw new Error("generateQuiz should not be called when listing quizzes");
    },
  });

  const response = await GET(
    new Request("http://localhost/api/study/quiz", {
      method: "GET",
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(operations, [
    ["quizzes.select", "id, document_id, title, quiz_json, created_at"],
    ["quizzes.eq", "user_id", "user-1"],
    ["quizzes.order", "created_at", { ascending: false }],
  ]);
  assert.deepEqual(await response.json(), [
    {
      id: "quiz-1",
      documentId: "document-9",
      title: null,
      quiz: sampleQuiz,
      questionCount: 1,
      createdAt: "2026-05-29T06:00:00.000Z",
    },
  ]);
});

test("study quiz GET filters saved quizzes by document id when provided", async () => {
  const operations = [];
  const { GET } = createStudyQuizRoute({
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
        assert.equal(table, "document_quizzes");

        return {
          select(columns) {
            operations.push(["quizzes.select", columns]);
            return this;
          },
          eq(column, value) {
            operations.push(["quizzes.eq", column, value]);
            return this;
          },
          order(column, options) {
            operations.push(["quizzes.order", column, options]);
            return {
              data: [],
              error: null,
            };
          },
        };
      },
    }),
    generateQuiz: async () => {
      throw new Error("generateQuiz should not be called when listing quizzes");
    },
  });

  const response = await GET(
    new Request("http://localhost/api/study/quiz?documentId=document-9", {
      method: "GET",
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(operations, [
    ["quizzes.select", "id, document_id, title, quiz_json, created_at"],
    ["quizzes.eq", "user_id", "user-1"],
    ["quizzes.eq", "document_id", "document-9"],
    ["quizzes.order", "created_at", { ascending: false }],
  ]);
  assert.deepEqual(await response.json(), []);
});

test("study quiz DELETE removes a current user saved quiz", async () => {
  const operations = [];
  const { DELETE } = createStudyQuizRoute({
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
        assert.equal(table, "document_quizzes");

        return {
          delete() {
            operations.push(["quizzes.delete"]);
            return this;
          },
          eq(column, value) {
            operations.push(["quizzes.eq", column, value]);

            if (column === "user_id") {
              return {
                error: null,
              };
            }

            return this;
          },
        };
      },
    }),
    generateQuiz: async () => {
      throw new Error("generateQuiz should not be called when deleting quizzes");
    },
  });

  const response = await DELETE(
    new Request("http://localhost/api/study/quiz", {
      method: "DELETE",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        quizId: "quiz-1",
      }),
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(operations, [
    ["quizzes.delete"],
    ["quizzes.eq", "id", "quiz-1"],
    ["quizzes.eq", "user_id", "user-1"],
  ]);
  assert.deepEqual(await response.json(), {
    success: true,
  });
});

test("study quiz DELETE requires a quiz id", async () => {
  const { DELETE } = createStudyQuizRoute({
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
        throw new Error("from() should not be called for invalid delete requests");
      },
    }),
    generateQuiz: async () => {
      throw new Error("generateQuiz should not be called for invalid delete requests");
    },
  });

  const response = await DELETE(
    new Request("http://localhost/api/study/quiz", {
      method: "DELETE",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    }),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "quizId is required.",
  });
});

test("study quiz route rejects unauthorized users", async () => {
  const { POST, GET, DELETE } = createStudyQuizRoute({
    createClient: async () => ({
      auth: {
        async getUser() {
          return {
            data: {
              user: null,
            },
          };
        },
      },
      from() {
        throw new Error("from() should not be called for unauthorized requests");
      },
    }),
    generateQuiz: async () => {
      throw new Error("generateQuiz should not be called for unauthorized requests");
    },
  });

  const postResponse = await POST(
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
  const getResponse = await GET(
    new Request("http://localhost/api/study/quiz", {
      method: "GET",
    }),
  );
  const deleteResponse = await DELETE(
    new Request("http://localhost/api/study/quiz", {
      method: "DELETE",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        quizId: "quiz-1",
      }),
    }),
  );

  assert.equal(postResponse.status, 401);
  assert.equal(getResponse.status, 401);
  assert.equal(deleteResponse.status, 401);
});

test("study quiz route requires a document id for POST requests", async () => {
  const { POST } = createStudyQuizRoute({
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

  const response = await POST(
    new Request("http://localhost/api/study/quiz", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        count: 5,
      }),
    }),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "documentId is required.",
  });
});

test("study quiz route rejects invalid quiz counts", async () => {
  const { POST } = createStudyQuizRoute({
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

  const response = await POST(
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
