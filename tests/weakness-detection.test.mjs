import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_WEAKNESS_MODEL,
  buildWeaknessHeuristicSignals,
  generateWeaknessDetection,
} from "../src/lib/weakness-detection.ts";
import { createWeaknessDetectionRoute } from "../src/lib/weakness-detection-route.ts";

const sampleActivity = {
  recentChats: [
    {
      documentTitle: "String Matching Notes",
      role: "user",
      excerpt: "I still do not understand the KMP prefix function transitions.",
      createdAt: "2026-06-01T06:00:00.000Z",
    },
  ],
  recentNotes: [
    {
      documentTitle: "String Matching Notes",
      title: "Prefix table confusion",
      excerpt: "Need to revisit KMP prefix table construction.",
      createdAt: "2026-06-01T07:00:00.000Z",
    },
  ],
  recentQuizzes: [
    {
      documentTitle: "Graph Notes",
      title: "Maximum Flow Review",
      excerpts: [
        "How does maximum flow use residual capacity?",
        "Residual capacity explains whether an augmenting path can add flow.",
      ],
      createdAt: "2026-06-01T08:00:00.000Z",
    },
  ],
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

function createSupabaseStub(tableHandlers, user = { id: "user-1" }) {
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
              user,
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

test("buildWeaknessHeuristicSignals ranks repeated weak topic candidates", () => {
  const signals = buildWeaknessHeuristicSignals(sampleActivity);

  assert.equal(signals[0]?.topic, "KMP Prefix");
  assert.equal(signals[0]?.chats, 1);
  assert.equal(signals[0]?.notes, 1);
  assert.ok(signals.some((signal) => signal.topic === "Maximum Flow"));
});

test("generateWeaknessDetection sends the weakness prompt and parses JSON topics", async () => {
  process.env.OPENAI_API_KEY = "test-api-key";
  process.env.OPENAI_BASE_URL = "https://compatible.example/v1";
  process.env.OPENAI_MODEL = "test-weakness-model";
  delete process.env.HTTPS_PROXY;
  delete process.env.HTTP_PROXY;

  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(String(init?.body));
    const requestUrl =
      typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;

    assert.equal(requestUrl, "https://compatible.example/v1/chat/completions");
    assert.equal(init?.method, "POST");
    assert.equal(body.model, "test-weakness-model");
    assert.match(body.messages[0].content, /Detect likely weak study topics/);
    assert.match(body.messages.at(-1).content, /Return at most 3 weak topics/);
    assert.match(body.messages.at(-1).content, /Recent study activity:/);
    assert.match(body.messages.at(-1).content, /Lightweight heuristic signals:/);
    assert.match(body.messages.at(-1).content, /KMP prefix function transitions/);
    assert.match(body.messages.at(-1).content, /Maximum Flow Review/);

    return new Response(
      JSON.stringify({
        id: "chatcmpl-test",
        object: "chat.completion",
        created: 0,
        model: "test-weakness-model",
        choices: [
          {
            index: 0,
            finish_reason: "stop",
            message: {
              role: "assistant",
              content: JSON.stringify([
                {
                  topic: "KMP Prefix Function",
                  confidence: "High",
                  reason: "It appears in a question and a saved note.",
                  suggestedAction: "Review prefix table construction and explain one example.",
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

  const result = await generateWeaknessDetection(sampleActivity);

  assert.deepEqual(result, [
    {
      topic: "KMP Prefix Function",
      confidence: "High",
      reason: "It appears in a question and a saved note.",
      suggestedAction: "Review prefix table construction and explain one example.",
    },
  ]);
});

test("generateWeaknessDetection defaults OPENAI_MODEL to the weakness default", async () => {
  process.env.OPENAI_API_KEY = "test-api-key";
  process.env.OPENAI_BASE_URL = "https://compatible.example/v1";
  delete process.env.OPENAI_MODEL;
  delete process.env.HTTPS_PROXY;
  delete process.env.HTTP_PROXY;

  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body));

    assert.equal(body.model, DEFAULT_WEAKNESS_MODEL);

    return new Response(
      JSON.stringify({
        id: "chatcmpl-test",
        object: "chat.completion",
        created: 0,
        model: DEFAULT_WEAKNESS_MODEL,
        choices: [
          {
            index: 0,
            finish_reason: "stop",
            message: {
              role: "assistant",
              content: "[]",
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

  assert.deepEqual(await generateWeaknessDetection(sampleActivity), []);
});

test("weakness detection POST loads current user activity and returns weak topics", async () => {
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
            content: "I am confused by the KMP prefix function.",
            created_at: "2026-06-01T06:00:00.000Z",
          },
        ]);
      },
    ],
    document_notes: [
      (state) => {
        assert.equal(state.select, "id, document_id, title, content, created_at");
        assert.deepEqual(state.eq, [["user_id", "user-1"]]);
        assert.deepEqual(state.order, [["created_at", { ascending: false }]]);
        assert.equal(state.limit, 10);
        return createQueryResponse([
          {
            id: "note-1",
            document_id: "document-1",
            title: "KMP reminders",
            content: "Need another pass on prefix table transitions.",
            created_at: "2026-06-01T07:00:00.000Z",
          },
        ]);
      },
    ],
    document_quizzes: [
      (state) => {
        assert.equal(state.select, "id, document_id, title, quiz_json, created_at");
        assert.deepEqual(state.eq, [["user_id", "user-1"]]);
        assert.deepEqual(state.order, [["created_at", { ascending: false }]]);
        assert.equal(state.limit, 10);
        return createQueryResponse([
          {
            id: "quiz-1",
            document_id: "document-2",
            title: "Flow Review",
            quiz_json: [
              {
                question: "What is residual capacity?",
                type: "short answer",
                answer: "Remaining capacity.",
                explanation: "Residual capacity controls augmenting paths.",
              },
            ],
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
            file_name: "String Matching Notes",
          },
          {
            id: "document-2",
            file_name: "Graph Notes",
          },
        ]);
      },
    ],
  });
  const { POST } = createWeaknessDetectionRoute({
    createClient: async () => client,
    generateWeaknesses: async (activity) => {
      capturedActivity = activity;

      return [
        {
          topic: "KMP Prefix Function",
          confidence: "High",
          reason: "It appears in recent chats and notes.",
          suggestedAction: "Rebuild the prefix table for one example string.",
        },
      ];
    },
  });

  const response = await POST();

  assert.equal(response.status, 200);
  assert.equal(capturedActivity.recentChats[0]?.documentTitle, "String Matching Notes");
  assert.equal(capturedActivity.recentNotes[0]?.excerpt, "Need another pass on prefix table transitions.");
  assert.equal(capturedActivity.recentQuizzes[0]?.excerpts[0], "What is residual capacity?");
  assert.deepEqual(await response.json(), {
    weakTopics: [
      {
        topic: "KMP Prefix Function",
        confidence: "High",
        reason: "It appears in recent chats and notes.",
        suggestedAction: "Rebuild the prefix table for one example string.",
      },
    ],
  });
  assert.equal(
    operations.filter(([name, table]) => name === "from" && table === "document_chat_messages").length,
    1,
  );
  assert.equal(
    operations.filter(([name, table]) => name === "from" && table === "document_notes").length,
    1,
  );
  assert.equal(
    operations.filter(([name, table]) => name === "from" && table === "document_quizzes").length,
    1,
  );
  assert.equal(
    operations.filter(([name, table]) => name === "from" && table === "documents").length,
    1,
  );
});

test("weakness detection POST skips the LLM when there is no study activity", async () => {
  const { client } = createSupabaseStub({
    document_chat_messages: [() => createQueryResponse([])],
    document_notes: [() => createQueryResponse([])],
    document_quizzes: [() => createQueryResponse([])],
  });
  const { POST } = createWeaknessDetectionRoute({
    createClient: async () => client,
    generateWeaknesses: async () => {
      throw new Error("generateWeaknesses should not be called without activity");
    },
  });

  const response = await POST();

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    weakTopics: [],
  });
});

test("weakness detection POST rejects unauthorized users", async () => {
  const { POST } = createWeaknessDetectionRoute({
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
    generateWeaknesses: async () => {
      throw new Error("generateWeaknesses should not be called for unauthorized users");
    },
  });

  const response = await POST();

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    error: "Unauthorized.",
  });
});
