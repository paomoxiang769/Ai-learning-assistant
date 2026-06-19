import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  DEFAULT_FLASHCARD_MODEL,
  generateStudyFlashcards,
  normalizeFlashcardListPayload,
} from "../src/lib/study-flashcards.ts";
import { createStudyFlashcardsRoute } from "../src/lib/study-flashcards-route.ts";

const sampleFlashcards = [
  {
    question: "What does binary search require?",
    answer: "A sorted search space.",
  },
  {
    question: "Why does binary search halve the range?",
    answer: "The midpoint comparison eliminates one ordered half.",
  },
  {
    question: "What does the midpoint comparison decide?",
    answer: "Which half of the sorted range can be discarded.",
  },
  {
    question: "What happens if the data is unsorted?",
    answer: "The direction from the midpoint comparison is unreliable.",
  },
  {
    question: "What is the main efficiency idea?",
    answer: "Each step reduces the remaining search space by about half.",
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

test("flashcards migration creates user-scoped table and RLS policies", async () => {
  const migration = await readFile(
    new URL("../supabase/migrations/20260619_document_flashcards_v1.sql", import.meta.url),
    "utf8",
  );

  assert.match(migration, /create table if not exists public\.document_flashcards/);
  assert.match(migration, /id uuid primary key default gen_random_uuid\(\)/);
  assert.match(migration, /document_id uuid not null references public\.documents\(id\) on delete cascade/);
  assert.match(migration, /user_id uuid not null/);
  assert.match(migration, /question text not null/);
  assert.match(migration, /answer text not null/);
  assert.match(migration, /alter table public\.document_flashcards enable row level security/);
  assert.match(migration, /for select/);
  assert.match(migration, /for insert/);
  assert.match(migration, /for delete/);
  assert.match(migration, /user_id = auth\.uid\(\)/);
});

test("normalizeFlashcardListPayload keeps valid question answer pairs", () => {
  assert.deepEqual(
    normalizeFlashcardListPayload({
      flashcards: [
        { question: " What is KMP? ", answer: " A string matching algorithm. " },
        { question: "", answer: "Missing question" },
      ],
    }),
    [
      {
        question: "What is KMP?",
        answer: "A string matching algorithm.",
      },
    ],
  );
});

test("generateStudyFlashcards sends summary notes and quizzes to the OpenAI-compatible API", async () => {
  process.env.OPENAI_API_KEY = "test-api-key";
  process.env.OPENAI_BASE_URL = "https://compatible.example/v1";
  process.env.OPENAI_MODEL = "test-flashcard-model";
  delete process.env.HTTPS_PROXY;
  delete process.env.HTTP_PROXY;
  let capturedPrompt = "";

  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(String(init?.body));
    const requestUrl =
      typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;

    assert.equal(requestUrl, "https://compatible.example/v1/chat/completions");
    assert.equal(init?.method, "POST");
    assert.equal(body.model, "test-flashcard-model");
    assert.match(body.messages[0].content, /Generate compact study flashcards/i);
    capturedPrompt = body.messages.at(-1).content;

    return new Response(
      JSON.stringify({
        id: "chatcmpl-test",
        object: "chat.completion",
        created: 0,
        model: "test-flashcard-model",
        choices: [
          {
            index: 0,
            finish_reason: "stop",
            message: {
              role: "assistant",
              content: JSON.stringify(sampleFlashcards),
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

  const result = await generateStudyFlashcards({
    documentTitle: "Algorithms",
    summary: "Binary search repeatedly halves a sorted search space.",
    notes: ["Remember sorted order."],
    quizExcerpts: ["Q: What is required? A: A sorted array."],
  });

  assert.deepEqual(result, sampleFlashcards);
  assert.match(capturedPrompt, /Document title: Algorithms/);
  assert.match(capturedPrompt, /Summary:/);
  assert.match(capturedPrompt, /Binary search repeatedly halves/);
  assert.match(capturedPrompt, /Notes:/);
  assert.match(capturedPrompt, /Remember sorted order/);
  assert.match(capturedPrompt, /Quiz excerpts:/);
  assert.match(capturedPrompt, /A sorted array/);
});

test("generateStudyFlashcards defaults OPENAI_MODEL to the flashcard default", async () => {
  process.env.OPENAI_API_KEY = "test-api-key";
  process.env.OPENAI_BASE_URL = "https://compatible.example/v1";
  delete process.env.OPENAI_MODEL;
  delete process.env.HTTPS_PROXY;
  delete process.env.HTTP_PROXY;

  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    assert.equal(body.model, DEFAULT_FLASHCARD_MODEL);

    return new Response(
      JSON.stringify({
        id: "chatcmpl-test",
        object: "chat.completion",
        created: 0,
        model: DEFAULT_FLASHCARD_MODEL,
        choices: [
          {
            index: 0,
            finish_reason: "stop",
            message: {
              role: "assistant",
              content: JSON.stringify(sampleFlashcards),
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

  const result = await generateStudyFlashcards({
    documentTitle: "Algorithms",
    summary: "Binary search summary.",
    notes: [],
    quizExcerpts: [],
  });

  assert.equal(result.length, 5);
});

test("flashcards generate route loads current user sources and saves generated cards", async () => {
  const operations = [];
  let capturedInput = null;
  const { POST } = createStudyFlashcardsRoute({
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
                  id: "document-1",
                  file_name: "Algorithms",
                  summary: "Binary search halves sorted data.",
                  processing_status: "completed",
                },
                error: null,
              };
            },
          };
        }

        if (table === "document_notes") {
          return {
            select(columns) {
              operations.push(["notes.select", columns]);
              return this;
            },
            eq(column, value) {
              operations.push(["notes.eq", column, value]);
              return this;
            },
            order(column, options) {
              operations.push(["notes.order", column, options]);
              return this;
            },
            limit(value) {
              operations.push(["notes.limit", value]);
              return {
                data: [{ content: "Sorted order is required." }],
                error: null,
              };
            },
          };
        }

        if (table === "document_quizzes") {
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
              return this;
            },
            limit(value) {
              operations.push(["quizzes.limit", value]);
              return {
                data: [
                  {
                    quiz_json: [
                      {
                        question: "What does binary search require?",
                        type: "short answer",
                        answer: "Sorted data.",
                        explanation: "Order allows discarding half.",
                      },
                    ],
                  },
                ],
                error: null,
              };
            },
          };
        }

        if (table === "document_flashcards") {
          return {
            insert(payload) {
              operations.push(["flashcards.insert", payload]);
              return this;
            },
            select(columns) {
              operations.push(["flashcards.select", columns]);
              return this;
            },
            order(column, options) {
              operations.push(["flashcards.order", column, options]);
              return {
                data: [
                  {
                    id: "flashcard-1",
                    document_id: "document-1",
                    question: sampleFlashcards[0].question,
                    answer: sampleFlashcards[0].answer,
                    created_at: "2026-06-19T00:00:00.000Z",
                  },
                ],
                error: null,
              };
            },
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      },
    }),
    generateFlashcards: async (input) => {
      capturedInput = input;
      return [sampleFlashcards[0]];
    },
  });

  const response = await POST(
    new Request("http://localhost/api/study/flashcards/generate", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ documentId: "document-1" }),
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(capturedInput, {
    documentTitle: "Algorithms",
    summary: "Binary search halves sorted data.",
    notes: ["Sorted order is required."],
    quizExcerpts: [
      "Q: What does binary search require?\nA: Sorted data.\nExplanation: Order allows discarding half.",
    ],
  });
  assert.deepEqual(
    operations.filter(([name]) => name.endsWith(".eq")),
    [
      ["documents.eq", "id", "document-1"],
      ["documents.eq", "user_id", "user-1"],
      ["notes.eq", "user_id", "user-1"],
      ["notes.eq", "document_id", "document-1"],
      ["quizzes.eq", "user_id", "user-1"],
      ["quizzes.eq", "document_id", "document-1"],
    ],
  );
  assert.deepEqual(await response.json(), [
    {
      id: "flashcard-1",
      documentId: "document-1",
      question: sampleFlashcards[0].question,
      answer: sampleFlashcards[0].answer,
      createdAt: "2026-06-19T00:00:00.000Z",
    },
  ]);
});

test("flashcards GET filters current user cards by document id", async () => {
  const operations = [];
  const { GET } = createStudyFlashcardsRoute({
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
        assert.equal(table, "document_flashcards");
        return {
          select(columns) {
            operations.push(["flashcards.select", columns]);
            return this;
          },
          eq(column, value) {
            operations.push(["flashcards.eq", column, value]);
            return this;
          },
          order(column, options) {
            operations.push(["flashcards.order", column, options]);
            return {
              data: [],
              error: null,
            };
          },
        };
      },
    }),
    generateFlashcards: async () => {
      throw new Error("generateFlashcards should not be called for GET");
    },
  });

  const response = await GET(
    new Request("http://localhost/api/study/flashcards?documentId=document-1"),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(operations, [
    ["flashcards.select", "id, document_id, question, answer, created_at"],
    ["flashcards.eq", "user_id", "user-1"],
    ["flashcards.eq", "document_id", "document-1"],
    ["flashcards.order", "created_at", { ascending: false }],
  ]);
});

test("flashcards DELETE removes one current user card", async () => {
  const operations = [];
  const { DELETE } = createStudyFlashcardsRoute({
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
        assert.equal(table, "document_flashcards");
        return {
          delete() {
            operations.push(["flashcards.delete"]);
            return this;
          },
          eq(column, value) {
            operations.push(["flashcards.eq", column, value]);
            if (column === "user_id") {
              return { error: null };
            }
            return this;
          },
        };
      },
    }),
    generateFlashcards: async () => {
      throw new Error("generateFlashcards should not be called for DELETE");
    },
  });

  const response = await DELETE(
    new Request("http://localhost/api/study/flashcards", {
      method: "DELETE",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ flashcardId: "flashcard-1" }),
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(operations, [
    ["flashcards.delete"],
    ["flashcards.eq", "id", "flashcard-1"],
    ["flashcards.eq", "user_id", "user-1"],
  ]);
  assert.deepEqual(await response.json(), { success: true });
});

test("flashcards route rejects unauthorized users", async () => {
  const { POST, GET, DELETE } = createStudyFlashcardsRoute({
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
    generateFlashcards: async () => {
      throw new Error("generateFlashcards should not be called");
    },
  });

  const postResponse = await POST(
    new Request("http://localhost/api/study/flashcards/generate", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ documentId: "document-1" }),
    }),
  );
  const getResponse = await GET(
    new Request("http://localhost/api/study/flashcards"),
  );
  const deleteResponse = await DELETE(
    new Request("http://localhost/api/study/flashcards", {
      method: "DELETE",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ flashcardId: "flashcard-1" }),
    }),
  );

  assert.equal(postResponse.status, 401);
  assert.equal(getResponse.status, 401);
  assert.equal(deleteResponse.status, 401);
});
