import assert from "node:assert/strict";
import test from "node:test";
import {
  createSemanticSearchRoute,
  createSemanticSearchService,
} from "../src/lib/semantic-search.ts";

function createQueryResponse(data, error = null) {
  return {
    data,
    error,
  };
}

function createSupabaseStub({
  userId = "user-1",
  tableHandlers = {},
  rpcHandler = () => createQueryResponse([]),
} = {}) {
  const operations = [];
  const queue = new Map(
    Object.entries(tableHandlers).map(([table, handlers]) => [table, [...handlers]]),
  );

  return {
    operations,
    client: {
      auth: {
        async getUser() {
          operations.push(["auth.getUser"]);
          return {
            data: {
              user: userId ? { id: userId } : null,
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
          then(resolve, reject) {
            return Promise.resolve()
              .then(() => handler(state))
              .then(resolve, reject);
          },
        };
      },
      async rpc(fnName, params) {
        operations.push(["rpc", fnName, params]);
        return await rpcHandler(fnName, params);
      },
    },
  };
}

const documentRows = [
  {
    id: "document-1",
    file_name: "KMP Notes.pdf",
    created_at: "2026-06-01T06:00:00.000Z",
  },
  {
    id: "document-2",
    file_name: "Graph Traversal.pdf",
    created_at: "2026-06-01T05:00:00.000Z",
  },
];

test("semantic search generates one query embedding and returns user-owned study assets with inherited relevance", async () => {
  let embeddingCalls = 0;
  const { client, operations } = createSupabaseStub({
    tableHandlers: {
      documents: [
        (state) => {
          assert.equal(state.select, "id, file_name, created_at");
          assert.deepEqual(state.eq, [
            ["user_id", "user-1"],
            ["processing_status", "completed"],
          ]);
          return createQueryResponse(documentRows);
        },
      ],
      document_notes: [
        (state) => {
          assert.equal(state.select, "id, document_id, title, content, created_at");
          assert.deepEqual(state.eq, [["user_id", "user-1"]]);
          assert.deepEqual(state.in, [["document_id", ["document-1"]]]);
          return createQueryResponse([
            {
              id: "note-1",
              document_id: "document-1",
              title: "Prefix table",
              content: "KMP skips repeated comparisons.",
              created_at: "2026-06-01T07:00:00.000Z",
            },
          ]);
        },
      ],
      document_quizzes: [
        (state) => {
          assert.equal(state.select, "id, document_id, title, quiz_json, created_at");
          assert.deepEqual(state.eq, [["user_id", "user-1"]]);
          assert.deepEqual(state.in, [["document_id", ["document-1"]]]);
          return createQueryResponse([
            {
              id: "quiz-1",
              document_id: "document-1",
              title: null,
              quiz_json: [
                {
                  question: "What does KMP preprocess?",
                  type: "short answer",
                  answer: "A prefix table.",
                  explanation: "The prefix table lets KMP skip repeated comparisons.",
                },
              ],
              created_at: "2026-06-01T08:00:00.000Z",
            },
          ]);
        },
      ],
      document_flashcards: [
        (state) => {
          assert.equal(state.select, "id, document_id, question, answer, created_at");
          assert.deepEqual(state.eq, [["user_id", "user-1"]]);
          assert.deepEqual(state.in, [["document_id", ["document-1"]]]);
          return createQueryResponse([
            {
              id: "flashcard-1",
              document_id: "document-1",
              question: "How does KMP avoid repeated comparisons?",
              answer: "It uses a prefix table.",
              created_at: "2026-06-01T09:00:00.000Z",
            },
          ]);
        },
      ],
    },
    rpcHandler(fnName, params) {
      assert.equal(fnName, "match_document_chunks");
      assert.deepEqual(params.query_embedding, [0.11, 0.22, 0.33]);
      assert.equal(params.match_count, 1);

      if (params.filter_document_id === "document-1") {
        return createQueryResponse([
          {
            id: "chunk-1",
            document_id: "document-1",
            chunk_index: 0,
            content: "KMP avoids repeated comparisons with prefix function fallback.",
            similarity: 0.923,
          },
        ]);
      }

      return createQueryResponse([]);
    },
  });

  const search = createSemanticSearchService({
    createClient: async () => client,
    generateEmbedding: async (query) => {
      embeddingCalls += 1;
      assert.equal(query, "algorithm that avoids repeated comparisons");
      return [0.11, 0.22, 0.33];
    },
  });

  const response = await search({
    query: "algorithm that avoids repeated comparisons",
    userId: "user-1",
  });

  assert.equal(embeddingCalls, 1);
  assert.equal(response.mode, "semantic");
  assert.deepEqual(
    response.results.map((result) => ({
      id: result.id,
      type: result.type,
      title: result.title,
      relevancePercent: result.relevancePercent,
    })),
    [
      {
        id: "document-1",
        type: "document",
        title: "KMP Notes.pdf",
        relevancePercent: 92,
      },
      {
        id: "note-1",
        type: "note",
        title: "Prefix table",
        relevancePercent: 92,
      },
      {
        id: "quiz-1",
        type: "quiz",
        title: "KMP Notes.pdf",
        relevancePercent: 92,
      },
      {
        id: "flashcard-1",
        type: "flashcard",
        title: "How does KMP avoid repeated comparisons?",
        relevancePercent: 92,
      },
    ],
  );
  assert.deepEqual(
    operations
      .filter(([name]) => name === "rpc")
      .map((operation) => operation[2].filter_document_id),
    ["document-1", "document-2"],
  );
});

test("semantic search falls back to keyword results when embedding generation fails", async () => {
  const { client } = createSupabaseStub({
    tableHandlers: {
      documents: [
        () => createQueryResponse(documentRows),
        () => createQueryResponse(documentRows),
        () => createQueryResponse([
          {
            id: "document-1",
            file_name: "KMP Notes.pdf",
          },
        ]),
      ],
      document_notes: [
        () =>
          createQueryResponse([
            {
              id: "note-1",
              document_id: "document-1",
              title: "Prefix function",
              content: "KMP avoids repeated comparisons.",
              created_at: "2026-06-01T07:00:00.000Z",
            },
          ]),
      ],
      document_quizzes: [
        () =>
          createQueryResponse([
            {
              id: "quiz-1",
              document_id: "document-1",
              title: null,
              quiz_json: [
                {
                  question: "What does KMP use?",
                  type: "short answer",
                  answer: "A prefix table.",
                  explanation: "It avoids repeated comparisons.",
                },
              ],
              created_at: "2026-06-01T08:00:00.000Z",
            },
          ]),
      ],
      document_flashcards: [
        () =>
          createQueryResponse([
            {
              id: "flashcard-1",
              document_id: "document-1",
              question: "How does KMP avoid repeated comparisons?",
              answer: "It uses prefix fallback.",
              created_at: "2026-06-01T09:00:00.000Z",
            },
          ]),
      ],
    },
  });

  const search = createSemanticSearchService({
    createClient: async () => client,
    generateEmbedding: async () => {
      throw new Error("OPENAI_API_KEY is not configured.");
    },
  });

  const response = await search({
    query: "repeated comparisons",
    userId: "user-1",
  });

  assert.equal(response.mode, "keyword");
  assert.deepEqual(
    response.results.map((result) => [result.id, result.type, result.relevancePercent]),
    [
      ["note-1", "note", null],
      ["quiz-1", "quiz", null],
      ["flashcard-1", "flashcard", null],
    ],
  );
});

test("semantic search falls back to keyword results when vector retrieval fails", async () => {
  const { client } = createSupabaseStub({
    tableHandlers: {
      documents: [
        () => createQueryResponse(documentRows),
        () => createQueryResponse(documentRows),
        () => createQueryResponse([
          {
            id: "document-1",
            file_name: "KMP Notes.pdf",
          },
        ]),
      ],
      document_notes: [
        () =>
          createQueryResponse([
            {
              id: "note-1",
              document_id: "document-1",
              title: "Prefix function",
              content: "KMP avoids repeated comparisons.",
              created_at: "2026-06-01T07:00:00.000Z",
            },
          ]),
      ],
      document_quizzes: [() => createQueryResponse([])],
      document_flashcards: [() => createQueryResponse([])],
    },
    rpcHandler() {
      return createQueryResponse(null, { message: "vector index unavailable" });
    },
  });

  const search = createSemanticSearchService({
    createClient: async () => client,
    generateEmbedding: async () => [0.44, 0.55],
  });

  const response = await search({
    query: "repeated comparisons",
    userId: "user-1",
  });

  assert.equal(response.mode, "keyword");
  assert.deepEqual(response.results.map((result) => result.id), ["note-1"]);
});

test("semantic search route rejects unauthenticated users", async () => {
  const { client } = createSupabaseStub({ userId: null });
  const { POST } = createSemanticSearchRoute({
    createClient: async () => client,
    generateEmbedding: async () => {
      throw new Error("generateEmbedding should not be called");
    },
  });

  const response = await POST(
    new Request("http://localhost/api/study/search", {
      method: "POST",
      body: JSON.stringify({ query: "KMP" }),
    }),
  );

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "Unauthorized." });
});
