import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGlobalSearchResults,
  buildKeywordSearchResults,
  filterDocumentsForSearch,
  filterFlashcardsForSearch,
  filterNotesForSearch,
  filterQuizzesForSearch,
  filterReviewItemsForSearch,
  normalizeSearchQuery,
} from "../src/lib/search.ts";

const documents = [
  {
    id: "document-1",
    fileName: "KMP Pattern Matching.pdf",
    href: "/documents/document-1",
  },
  {
    id: "document-2",
    fileName: "Graph Traversal.txt",
    href: "/documents/document-2",
  },
];

const notes = [
  {
    id: "note-1",
    title: "Prefix table",
    content: "KMP avoids repeated comparisons by using a prefix function.",
    href: "/documents/document-1?noteId=note-1",
  },
  {
    id: "note-2",
    title: "Graph queue",
    content: "Breadth-first search uses a queue.",
    href: "/documents/document-2?noteId=note-2",
  },
];

const quizzes = [
  {
    id: "quiz-1",
    title: null,
    documentTitle: "String Algorithms",
    href: "/documents/document-1?quizId=quiz-1",
    quiz: [
      {
        question: "What does KMP preprocess?",
        type: "short answer",
        answer: "A prefix table.",
        explanation: "KMP uses prefix lengths to skip repeated comparisons.",
      },
    ],
  },
  {
    id: "quiz-2",
    title: null,
    documentTitle: "Graphs",
    href: "/documents/document-2?quizId=quiz-2",
    quiz: [
      {
        question: "What does BFS use?",
        type: "short answer",
        answer: "A queue.",
        explanation: "The queue preserves discovery order.",
      },
    ],
  },
];

const flashcards = [
  {
    id: "flashcard-1",
    documentId: "document-1",
    documentTitle: "String Algorithms",
    question: "How does KMP avoid repeated comparisons?",
    answer: "It reuses prefix table information after a mismatch.",
    href: "/documents/document-1?flashcardId=flashcard-1",
  },
  {
    id: "flashcard-2",
    documentId: "document-2",
    documentTitle: "Graphs",
    question: "What does BFS use?",
    answer: "A queue.",
    href: "/documents/document-2?flashcardId=flashcard-2",
  },
];

test("normalizeSearchQuery trims and lowercases search input", () => {
  assert.equal(normalizeSearchQuery("  KMP  "), "kmp");
});

test("buildGlobalSearchResults returns document note and quiz hits for KMP", () => {
  const results = buildGlobalSearchResults({
    query: "KMP",
    documents,
    notes,
    quizzes,
  });

  assert.deepEqual(
    results.documents.map((document) => document.id),
    ["document-1"],
  );
  assert.deepEqual(
    results.notes.map((note) => note.id),
    ["note-1"],
  );
  assert.deepEqual(
    results.quizzes.map((quiz) => quiz.id),
    ["quiz-1"],
  );
  assert.equal(results.totalCount, 3);
});

test("empty search query returns unfiltered grouped results", () => {
  const results = buildGlobalSearchResults({
    query: "",
    documents,
    notes,
    quizzes,
  });

  assert.equal(results.documents.length, documents.length);
  assert.equal(results.notes.length, notes.length);
  assert.equal(results.quizzes.length, quizzes.length);
  assert.equal(results.totalCount, 6);
});

test("filter helpers search the requested fields only", () => {
  assert.deepEqual(
    filterDocumentsForSearch(documents, "graph").map((document) => document.id),
    ["document-2"],
  );
  assert.deepEqual(
    filterNotesForSearch(notes, "prefix function").map((note) => note.id),
    ["note-1"],
  );
  assert.deepEqual(
    filterQuizzesForSearch(quizzes, "skip repeated").map((quiz) => quiz.id),
    ["quiz-1"],
  );
  assert.deepEqual(
    filterFlashcardsForSearch(flashcards, "prefix table").map(
      (flashcard) => flashcard.id,
    ),
    ["flashcard-1"],
  );
});

test("buildKeywordSearchResults returns unified fallback results without semantic scores", () => {
  const results = buildKeywordSearchResults({
    query: "repeated comparisons",
    documents,
    notes,
    quizzes,
    flashcards,
  });

  assert.deepEqual(
    results.map((result) => ({
      id: result.id,
      type: result.type,
      title: result.title,
      relevancePercent: result.relevancePercent,
    })),
    [
      {
        id: "note-1",
        type: "note",
        title: "Prefix table",
        relevancePercent: null,
      },
      {
        id: "quiz-1",
        type: "quiz",
        title: "String Algorithms",
        relevancePercent: null,
      },
      {
        id: "flashcard-1",
        type: "flashcard",
        title: "How does KMP avoid repeated comparisons?",
        relevancePercent: null,
      },
    ],
  );
});

test("filterReviewItemsForSearch searches review item text fields", () => {
  const reviewItems = [
    {
      id: "chat-1",
      searchableText: ["Dynamic programming memoization"],
    },
    {
      id: "note-1",
      searchableText: ["KMP prefix function", "String matching"],
    },
  ];

  assert.deepEqual(
    filterReviewItemsForSearch(reviewItems, "kmp").map((item) => item.id),
    ["note-1"],
  );
});
