import assert from "node:assert/strict";
import test from "node:test";
import { loadDashboardOverview } from "../src/lib/dashboard.ts";

function createQueryResponse(data, error = null, count = null) {
  return {
    data,
    error,
    count,
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
          selectOptions: null,
          eq: [],
          in: [],
          order: [],
          limit: null,
        };

        return {
          select(columns, options) {
            state.select = columns;
            state.selectOptions = options ?? null;
            operations.push(["select", table, columns, options ?? null]);
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

test("loadDashboardOverview returns user-scoped counts and recent activity", async () => {
  const { client, operations } = createSupabaseStub({
    documents: [
      (state) => {
        assert.equal(state.select, "id");
        assert.deepEqual(state.selectOptions, { count: "exact", head: true });
        assert.deepEqual(state.eq, [["user_id", "user-1"]]);
        return createQueryResponse(null, null, 7);
      },
      (state) => {
        assert.equal(state.select, "id");
        assert.deepEqual(state.selectOptions, { count: "exact", head: true });
        assert.deepEqual(state.eq, [
          ["user_id", "user-1"],
          ["processing_status", "completed"],
        ]);
        return createQueryResponse(null, null, 4);
      },
      (state) => {
        assert.equal(
          state.select,
          "id, file_name, processing_status, created_at",
        );
        assert.deepEqual(state.eq, [["user_id", "user-1"]]);
        assert.deepEqual(state.order, [["created_at", { ascending: false }]]);
        assert.equal(state.limit, 5);
        return createQueryResponse([
          {
            id: "document-3",
            file_name: "Trees.pdf",
            processing_status: "completed",
            created_at: "2026-05-29T08:00:00.000Z",
          },
          {
            id: "document-2",
            file_name: "Graphs.txt",
            processing_status: "pending",
            created_at: "2026-05-29T07:00:00.000Z",
          },
        ]);
      },
      (state) => {
        assert.equal(state.select, "id, file_name");
        assert.deepEqual(state.eq, [["user_id", "user-1"]]);
        assert.deepEqual(state.in, [["id", ["document-3", "document-2"]]]);
        return createQueryResponse([
          {
            id: "document-2",
            file_name: "Graphs.txt",
          },
          {
            id: "document-3",
            file_name: "Trees.pdf",
          },
        ]);
      },
    ],
    document_quizzes: [
      (state) => {
        assert.equal(state.select, "id");
        assert.deepEqual(state.selectOptions, { count: "exact", head: true });
        assert.deepEqual(state.eq, [["user_id", "user-1"]]);
        return createQueryResponse(null, null, 6);
      },
      (state) => {
        assert.equal(state.select, "id, document_id, quiz_json, created_at");
        assert.deepEqual(state.eq, [["user_id", "user-1"]]);
        assert.deepEqual(state.order, [["created_at", { ascending: false }]]);
        assert.equal(state.limit, 5);
        return createQueryResponse([
          {
            id: "quiz-2",
            document_id: "document-3",
            quiz_json: [
              {
                question: "What is a tree traversal?",
                type: "short answer",
                answer: "A way to visit tree nodes.",
                explanation: "Traversal defines node visit order.",
              },
              {
                question: "Which traversal visits root first?",
                type: "short answer",
                answer: "Preorder.",
                explanation: "Preorder visits root before children.",
              },
            ],
            created_at: "2026-05-29T09:00:00.000Z",
          },
          {
            id: "quiz-1",
            document_id: "document-2",
            quiz_json: {
              questions: [
                {
                  question: "What does a graph edge connect?",
                  type: "short answer",
                  answer: "Two vertices.",
                  explanation: "An edge represents a connection.",
                },
              ],
            },
            created_at: "2026-05-29T08:30:00.000Z",
          },
        ]);
      },
    ],
    document_chat_messages: [
      (state) => {
        assert.equal(state.select, "id");
        assert.deepEqual(state.selectOptions, { count: "exact", head: true });
        assert.deepEqual(state.eq, [["user_id", "user-1"]]);
        return createQueryResponse(null, null, 18);
      },
    ],
  });

  const overview = await loadDashboardOverview({
    supabase: client,
    userId: "user-1",
  });

  assert.deepEqual(overview, {
    totalDocuments: 7,
    processedDocuments: 4,
    totalSavedQuizzes: 6,
    totalChatMessages: 18,
    recentDocuments: [
      {
        id: "document-3",
        fileName: "Trees.pdf",
        processingStatus: "completed",
        createdAt: "2026-05-29T08:00:00.000Z",
        href: "/documents/document-3",
      },
      {
        id: "document-2",
        fileName: "Graphs.txt",
        processingStatus: "pending",
        createdAt: "2026-05-29T07:00:00.000Z",
        href: "/documents/document-2",
      },
    ],
    recentQuizzes: [
      {
        id: "quiz-2",
        documentId: "document-3",
        documentTitle: "Trees.pdf",
        questionCount: 2,
        createdAt: "2026-05-29T09:00:00.000Z",
        href: "/documents/document-3?quizId=quiz-2",
      },
      {
        id: "quiz-1",
        documentId: "document-2",
        documentTitle: "Graphs.txt",
        questionCount: 1,
        createdAt: "2026-05-29T08:30:00.000Z",
        href: "/documents/document-2?quizId=quiz-1",
      },
    ],
  });

  assert.equal(
    operations.filter(([name, table]) => name === "from" && table === "documents").length,
    4,
  );
  assert.equal(
    operations.filter(([name, table]) => name === "from" && table === "document_quizzes").length,
    2,
  );
  assert.equal(
    operations.filter(([name, table]) => name === "from" && table === "document_chat_messages").length,
    1,
  );
});

test("loadDashboardOverview returns zero counts and empty lists when no user data exists", async () => {
  const { client } = createSupabaseStub({
    documents: [
      () => createQueryResponse(null, null, null),
      () => createQueryResponse(null, null, null),
      () => createQueryResponse([]),
    ],
    document_quizzes: [
      () => createQueryResponse(null, null, null),
      (state) => {
        assert.equal(state.limit, 5);
        return createQueryResponse([]);
      },
    ],
    document_chat_messages: [() => createQueryResponse(null, null, null)],
  });

  const overview = await loadDashboardOverview({
    supabase: client,
    userId: "user-2",
  });

  assert.deepEqual(overview, {
    totalDocuments: 0,
    processedDocuments: 0,
    totalSavedQuizzes: 0,
    totalChatMessages: 0,
    recentDocuments: [],
    recentQuizzes: [],
  });
});

test("loadDashboardOverview returns zero and logs a warning when a count query fails", async () => {
  const originalConsoleError = console.error;
  const consoleErrors = [];
  console.error = (...args) => {
    consoleErrors.push(args);
  };

  const { client } = createSupabaseStub({
    documents: [
      () => createQueryResponse(null, { message: "database offline" }),
      () => createQueryResponse(null, null, 0),
      () => createQueryResponse([]),
    ],
    document_quizzes: [
      () => createQueryResponse(null, null, 0),
      () => createQueryResponse([]),
    ],
    document_chat_messages: [() => createQueryResponse(null, null, 0)],
  });

  try {
    const overview = await loadDashboardOverview({
      supabase: client,
      userId: "user-3",
    });

    assert.deepEqual(overview, {
      totalDocuments: 0,
      processedDocuments: 0,
      totalSavedQuizzes: 0,
      totalChatMessages: 0,
      recentDocuments: [],
      recentQuizzes: [],
    });
    assert.equal(consoleErrors.length, 1);
    assert.match(String(consoleErrors[0][0]), /Dashboard warning/);
    assert.deepEqual(consoleErrors[0][1], { message: "database offline" });
  } finally {
    console.error = originalConsoleError;
  }
});
