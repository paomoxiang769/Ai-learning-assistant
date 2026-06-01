import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_REVIEW_MODEL,
  generateReviewAdvice,
} from "../src/lib/study-review.ts";
import { createStudyReviewRoute } from "../src/lib/study-review-route.ts";

const sampleActivity = {
  recentChats: [
    {
      documentTitle: "String Matching Notes",
      role: "user",
      excerpt: "How does the KMP prefix function work?",
      createdAt: "2026-06-01T06:00:00.000Z",
    },
  ],
  recentQuizzes: [
    {
      documentTitle: "String Matching Notes",
      questionCount: 3,
      createdAt: "2026-06-01T06:30:00.000Z",
    },
  ],
  recentNotes: [
    {
      documentTitle: "Hashing Notes",
      title: "Rabin-Karp reminders",
      noteType: "manual",
      createdAt: "2026-06-01T07:00:00.000Z",
    },
  ],
  signals: {
    recentChatsCount: 1,
    recentQuizzesCount: 1,
    recentNotesCount: 1,
    mostStudiedDocumentTitle: "String Matching Notes",
  },
};

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

function createQueryResponse(data, error = null) {
  return {
    data,
    error,
  };
}

function createSupabaseStub(tableHandlers) {
  const operations = [];
  const queue = new Map(
    Object.entries(tableHandlers).map(([table, handlers]) => [table, [...handlers]]),
  );

  return {
    operations,
    client: {
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
        const handlers = queue.get(table);

        if (!handlers || handlers.length === 0) {
          throw new Error(`Unexpected table query: ${table}`);
        }

        const handler = handlers.shift();
        const state = {
          table,
          select: null,
          eq: [],
          in: [],
          order: [],
          limit: null,
        };

        return {
          select(columns) {
            state.select = columns;
            operations.push(["select", table, columns]);
            return this;
          },
          eq(column, value) {
            state.eq.push([column, value]);
            operations.push(["eq", table, column, value]);
            return this;
          },
          in(column, values) {
            state.in.push([column, values]);
            operations.push(["in", table, column, values]);
            return this;
          },
          order(column, options) {
            state.order.push([column, options]);
            operations.push(["order", table, column, options]);
            return this;
          },
          limit(value) {
            state.limit = value;
            operations.push(["limit", table, value]);
            return this;
          },
          then(resolve, reject) {
            return Promise.resolve()
              .then(() => handler(state))
              .then(resolve, reject);
          },
        };
      },
    },
  };
}

test("generateReviewAdvice sends recent study activity to the configured OpenAI-compatible API", async () => {
  process.env.OPENAI_API_KEY = "test-api-key";
  process.env.OPENAI_BASE_URL = "https://compatible.example/v1";
  process.env.OPENAI_MODEL = "test-review-model";
  delete process.env.HTTPS_PROXY;
  delete process.env.HTTP_PROXY;

  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(String(init?.body));
    const requestUrl =
      typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;

    assert.equal(requestUrl, "https://compatible.example/v1/chat/completions");
    assert.equal(init?.method, "POST");
    assert.equal(body.model, "test-review-model");
    assert.match(body.messages[0].content, /personalized study review advice/i);
    assert.match(body.messages.at(-1).content, /What to review next/);
    assert.match(body.messages.at(-1).content, /Why/);
    assert.match(body.messages.at(-1).content, /Suggested actions/);
    assert.match(body.messages.at(-1).content, /KMP prefix function/);
    assert.match(body.messages.at(-1).content, /Rabin-Karp/);
    assert.match(body.messages.at(-1).content, /Most studied document: String Matching Notes/);

    return new Response(
      JSON.stringify({
        id: "chatcmpl-test",
        object: "chat.completion",
        created: 0,
        model: "test-review-model",
        choices: [
          {
            index: 0,
            finish_reason: "stop",
            message: {
              role: "assistant",
              content: "- Review KMP prefix function\n- Revisit Rabin-Karp hashing\n- Try generating another quiz",
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

  const advice = await generateReviewAdvice(sampleActivity);

  assert.equal(
    advice,
    "- Review KMP prefix function\n- Revisit Rabin-Karp hashing\n- Try generating another quiz",
  );
});

test("generateReviewAdvice defaults OPENAI_MODEL to the review default", async () => {
  process.env.OPENAI_API_KEY = "test-api-key";
  process.env.OPENAI_BASE_URL = "https://compatible.example/v1";
  delete process.env.OPENAI_MODEL;
  delete process.env.HTTPS_PROXY;
  delete process.env.HTTP_PROXY;

  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body));

    assert.equal(body.model, DEFAULT_REVIEW_MODEL);

    return new Response(
      JSON.stringify({
        id: "chatcmpl-test",
        object: "chat.completion",
        created: 0,
        model: DEFAULT_REVIEW_MODEL,
        choices: [
          {
            index: 0,
            finish_reason: "stop",
            message: { role: "assistant", content: "Review your latest notes." },
          },
        ],
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  };

  const advice = await generateReviewAdvice(sampleActivity);

  assert.equal(advice, "Review your latest notes.");
});

test("study review POST loads current user activity and returns advice with signals", async () => {
  let capturedActivity = null;
  const { client, operations } = createSupabaseStub({
    document_chat_messages: [
      (state) => {
        assert.equal(state.select, "id, document_id, role, content, created_at");
        assert.deepEqual(state.eq, [["user_id", "user-1"]]);
        assert.deepEqual(state.order, [["created_at", { ascending: false }]]);
        assert.equal(state.limit, 10);
        return createQueryResponse([
          {
            id: "chat-1",
            document_id: "document-1",
            role: "user",
            content: "How does the KMP prefix function work?",
            created_at: "2026-06-01T06:00:00.000Z",
          },
          {
            id: "chat-2",
            document_id: "document-1",
            role: "assistant",
            content: "The prefix function tracks border lengths.",
            created_at: "2026-06-01T06:01:00.000Z",
          },
        ]);
      },
    ],
    document_quizzes: [
      (state) => {
        assert.equal(state.select, "id, document_id, quiz_json, created_at");
        assert.deepEqual(state.eq, [["user_id", "user-1"]]);
        assert.deepEqual(state.order, [["created_at", { ascending: false }]]);
        assert.equal(state.limit, 10);
        return createQueryResponse([
          {
            id: "quiz-1",
            document_id: "document-2",
            quiz_json: [
              {
                question: "What is Rabin-Karp?",
                type: "short answer",
                answer: "A string matching algorithm.",
                explanation: "It uses rolling hashes.",
              },
            ],
            created_at: "2026-06-01T07:00:00.000Z",
          },
        ]);
      },
    ],
    document_notes: [
      (state) => {
        assert.equal(state.select, "id, document_id, title, note_type, content, created_at");
        assert.deepEqual(state.eq, [["user_id", "user-1"]]);
        assert.deepEqual(state.order, [["created_at", { ascending: false }]]);
        assert.equal(state.limit, 10);
        return createQueryResponse([
          {
            id: "note-1",
            document_id: "document-1",
            title: "KMP reminders",
            note_type: "manual",
            content: "Review lps table construction.",
            created_at: "2026-06-01T08:00:00.000Z",
          },
        ]);
      },
    ],
    documents: [
      (state) => {
        assert.equal(state.select, "id, file_name");
        assert.deepEqual(state.eq, [["user_id", "user-1"]]);
        assert.deepEqual(state.in, [["id", ["document-1", "document-2"]]]);
        return createQueryResponse([
          {
            id: "document-1",
            file_name: "KMP Notes",
          },
          {
            id: "document-2",
            file_name: "Rabin-Karp Notes",
          },
        ]);
      },
    ],
  });
  const { POST } = createStudyReviewRoute({
    createClient: async () => client,
    generateAdvice: async (activity) => {
      capturedActivity = activity;

      return [
        "- Review KMP prefix function",
        "- Revisit Rabin-Karp hashing",
        "- Try generating another quiz",
      ].join("\n");
    },
  });

  const response = await POST(
    new Request("http://localhost/api/study/review", {
      method: "POST",
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(capturedActivity.signals, {
    recentChatsCount: 2,
    recentQuizzesCount: 1,
    recentNotesCount: 1,
    mostStudiedDocumentTitle: "KMP Notes",
  });
  assert.deepEqual(await response.json(), {
    advice: "- Review KMP prefix function\n- Revisit Rabin-Karp hashing\n- Try generating another quiz",
    signals: {
      recentChatsCount: 2,
      recentQuizzesCount: 1,
      recentNotesCount: 1,
      mostStudiedDocumentTitle: "KMP Notes",
    },
  });
  assert.equal(
    operations.filter(([name, table]) => name === "from" && table === "document_chat_messages").length,
    1,
  );
  assert.equal(
    operations.filter(([name, table]) => name === "from" && table === "document_quizzes").length,
    1,
  );
  assert.equal(
    operations.filter(([name, table]) => name === "from" && table === "document_notes").length,
    1,
  );
  assert.equal(
    operations.filter(([name, table]) => name === "from" && table === "documents").length,
    1,
  );
});

test("study review POST rejects unauthorized users", async () => {
  const { POST } = createStudyReviewRoute({
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
        throw new Error("from() should not be called for unauthorized users");
      },
    }),
    generateAdvice: async () => {
      throw new Error("generateAdvice should not be called for unauthorized users");
    },
  });

  const response = await POST(
    new Request("http://localhost/api/study/review", {
      method: "POST",
    }),
  );

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    error: "Unauthorized.",
  });
});
