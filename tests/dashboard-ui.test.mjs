import assert from "node:assert/strict";
import test from "node:test";
import { buildDashboardActivityFeed } from "../src/lib/dashboard-ui.ts";

test("buildDashboardActivityFeed combines recent quizzes, chats, notes, and documents", () => {
  const feed = buildDashboardActivityFeed({
    recentQuizzes: [
      {
        id: "quiz-1",
        documentId: "document-1",
        documentTitle: "Neural Networks.pdf",
        questionCount: 8,
        createdAt: "2026-06-08T10:00:00.000Z",
        href: "/documents/document-1?quizId=quiz-1",
      },
    ],
    recentDocuments: [
      {
        id: "document-2",
        fileName: "Linear Algebra.pdf",
        processingStatus: "completed",
        createdAt: "2026-06-07T12:00:00.000Z",
        href: "/documents/document-2",
      },
    ],
    studyActivitySummary: {
      chats: 5,
      quizzes: 1,
      notes: 3,
    },
  });

  assert.deepEqual(feed, [
    {
      id: "quiz-quiz-1",
      label: "Created quiz",
      title: "Neural Networks.pdf",
      meta: "8 questions",
      href: "/documents/document-1?quizId=quiz-1",
    },
    {
      id: "chat-summary",
      label: "Asked questions",
      title: "5 chat messages this week",
      meta: "Recent document study chats",
      href: "/chat",
    },
    {
      id: "note-summary",
      label: "Added notes",
      title: "3 notes this week",
      meta: "Saved study observations",
      href: "/review",
    },
    {
      id: "document-document-2",
      label: "Uploaded document",
      title: "Linear Algebra.pdf",
      meta: "Completed",
      href: "/documents/document-2",
    },
  ]);
});

test("buildDashboardActivityFeed returns an empty feed when there is no activity", () => {
  assert.deepEqual(
    buildDashboardActivityFeed({
      recentQuizzes: [],
      recentDocuments: [],
      studyActivitySummary: {
        chats: 0,
        quizzes: 0,
        notes: 0,
      },
    }),
    [],
  );
});
