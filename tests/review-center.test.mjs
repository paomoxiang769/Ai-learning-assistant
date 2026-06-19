import assert from "node:assert/strict";
import test from "node:test";
import { loadReviewCenter } from "../src/lib/review-center.ts";
import { getInitialStudyNote } from "../src/lib/study-notes-ui.ts";

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

test("loadReviewCenter returns recent user-scoped chats quizzes and notes", async () => {
  const { client, operations } = createSupabaseStub({
    document_chat_messages: [
      (state) => {
        assert.equal(state.select, "id, document_id, content, created_at");
        assert.deepEqual(state.eq, [
          ["user_id", "user-1"],
          ["role", "assistant"],
        ]);
        assert.deepEqual(state.order, [["created_at", { ascending: false }]]);
        assert.equal(state.limit, 10);

        return createQueryResponse([
          {
            id: "chat-1",
            document_id: "document-1",
            content:
              "This is a detailed assistant answer about dynamic programming and optimal substructure.",
            created_at: "2026-06-01T08:00:00.000Z",
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
            title: "Graph review",
            quiz_json: {
              questions: [
                {
                  question: "What is a graph?",
                  type: "short answer",
                  answer: "A set of vertices and edges.",
                  explanation: "Graphs model relationships.",
                },
              ],
            },
            created_at: "2026-06-01T07:00:00.000Z",
          },
        ]);
      },
    ],
    document_notes: [
      (state) => {
        assert.equal(
          state.select,
          "id, document_id, title, note_type, content, created_at",
        );
        assert.deepEqual(state.eq, [["user_id", "user-1"]]);
        assert.deepEqual(state.order, [["created_at", { ascending: false }]]);
        assert.equal(state.limit, 10);

        return createQueryResponse([
          {
            id: "note-1",
            document_id: "document-3",
            title: "Exam prep",
            note_type: "manual",
            content: "Review KMP prefix tables before the exam.",
            created_at: "2026-06-01T06:00:00.000Z",
          },
        ]);
      },
    ],
    document_flashcards: [
      (state) => {
        assert.equal(state.select, "id, document_id, question, answer, created_at");
        assert.deepEqual(state.eq, [["user_id", "user-1"]]);
        assert.deepEqual(state.order, [["created_at", { ascending: false }]]);
        assert.equal(state.limit, 10);

        return createQueryResponse([
          {
            id: "flashcard-1",
            document_id: "document-2",
            question: "What is a graph edge?",
            answer: "A connection between vertices.",
            created_at: "2026-06-01T05:00:00.000Z",
          },
        ]);
      },
    ],
    documents: [
      (state) => {
        assert.equal(state.select, "id, file_name");
        assert.deepEqual(state.eq, [["user_id", "user-1"]]);
        assert.deepEqual(state.in, [
          ["id", ["document-1", "document-2", "document-3"]],
        ]);

        return createQueryResponse([
          {
            id: "document-1",
            file_name: "Algorithms.pdf",
          },
          {
            id: "document-2",
            file_name: "Graphs.txt",
          },
          {
            id: "document-3",
            file_name: "Study Plan.md",
          },
        ]);
      },
    ],
  });

  const reviewCenter = await loadReviewCenter({
    supabase: client,
    userId: "user-1",
  });

  assert.deepEqual(reviewCenter, {
    recentChats: [
      {
        id: "chat-1",
        documentId: "document-1",
        documentTitle: "Algorithms.pdf",
        excerpt:
          "This is a detailed assistant answer about dynamic programming and optimal substructure.",
        createdAt: "2026-06-01T08:00:00.000Z",
        href: "/documents/document-1",
        searchableText: [
          "Algorithms.pdf",
          "This is a detailed assistant answer about dynamic programming and optimal substructure.",
        ],
      },
    ],
    recentQuizzes: [
      {
        id: "quiz-1",
        documentId: "document-2",
        documentTitle: "Graphs.txt",
        title: "Graph review",
        questionCount: 1,
        createdAt: "2026-06-01T07:00:00.000Z",
        href: "/documents/document-2?quizId=quiz-1",
        searchableText: [
          "Graphs.txt",
          "Graph review",
          "What is a graph?",
          "Graphs model relationships.",
        ],
      },
    ],
    recentNotes: [
      {
        id: "note-1",
        documentId: "document-3",
        documentTitle: "Study Plan.md",
        noteType: "manual",
        title: "Exam prep",
        content: "Review KMP prefix tables before the exam.",
        createdAt: "2026-06-01T06:00:00.000Z",
        href: "/documents/document-3?noteId=note-1",
        searchableText: [
          "Study Plan.md",
          "Exam prep",
          "Review KMP prefix tables before the exam.",
        ],
      },
    ],
    recentFlashcards: [
      {
        id: "flashcard-1",
        documentId: "document-2",
        documentTitle: "Graphs.txt",
        question: "What is a graph edge?",
        answer: "A connection between vertices.",
        createdAt: "2026-06-01T05:00:00.000Z",
        href: "/documents/document-2",
        searchableText: [
          "Graphs.txt",
          "What is a graph edge?",
          "A connection between vertices.",
        ],
      },
    ],
  });

  assert.equal(
    operations.filter(([name, table]) => name === "from" && table === "documents")
      .length,
    1,
  );
});

test("loadReviewCenter returns empty sections when no recent study history exists", async () => {
  const { client } = createSupabaseStub({
    document_chat_messages: [() => createQueryResponse([])],
    document_quizzes: [() => createQueryResponse([])],
    document_notes: [() => createQueryResponse([])],
    document_flashcards: [() => createQueryResponse([])],
  });

  const reviewCenter = await loadReviewCenter({
    supabase: client,
    userId: "user-2",
  });

  assert.deepEqual(reviewCenter, {
    recentChats: [],
    recentQuizzes: [],
    recentNotes: [],
    recentFlashcards: [],
  });
});

test("getInitialStudyNote returns the matching note for a noteId deep link", () => {
  const notes = [
    {
      id: "note-1",
      documentId: "document-1",
      title: "First",
      content: "First note",
      noteType: "manual",
      createdAt: "2026-06-01T06:00:00.000Z",
    },
    {
      id: "note-2",
      documentId: "document-1",
      title: "Second",
      content: "Second note",
      noteType: "ai_summary",
      createdAt: "2026-06-01T07:00:00.000Z",
    },
  ];

  assert.deepEqual(getInitialStudyNote(notes, "note-2"), notes[1]);
  assert.equal(getInitialStudyNote(notes, "missing-note"), null);
  assert.equal(getInitialStudyNote(notes, undefined), null);
});
