import type { StudyQuizQuestion } from "./study-quiz-types.ts";

export type SearchableDocument = {
  id: string;
  fileName: string;
  href: string;
};

export type SearchableNote = {
  id: string;
  title: string | null;
  content: string;
  href: string;
};

export type SearchableQuiz = {
  id: string;
  title: string | null;
  documentTitle?: string;
  quiz: StudyQuizQuestion[];
  href: string;
};

export type SearchableFlashcard = {
  id: string;
  documentId: string;
  documentTitle?: string;
  question: string;
  answer: string;
  href: string;
};

export type SearchableReviewItem = {
  searchableText: string[];
};

export type SemanticSearchResultType =
  | "document"
  | "note"
  | "quiz"
  | "flashcard";

export type SemanticSearchResult = {
  id: string;
  type: SemanticSearchResultType;
  title: string;
  href: string;
  similarity: number | null;
  relevancePercent: number | null;
  excerpt?: string;
};

export function normalizeSearchQuery(query: string) {
  return query.trim().toLowerCase();
}

function matchesSearchQuery(query: string, values: Array<string | null | undefined>) {
  const normalizedQuery = normalizeSearchQuery(query);

  if (!normalizedQuery) {
    return true;
  }

  return values.some((value) =>
    value?.toLowerCase().includes(normalizedQuery) ?? false,
  );
}

export function filterDocumentsForSearch<T extends SearchableDocument>(
  documents: T[],
  query: string,
) {
  return documents.filter((document) =>
    matchesSearchQuery(query, [document.fileName]),
  );
}

export function filterNotesForSearch<T extends { title: string | null; content: string }>(
  notes: T[],
  query: string,
) {
  return notes.filter((note) =>
    matchesSearchQuery(query, [note.title, note.content]),
  );
}

export function filterQuizzesForSearch<T extends { quiz: StudyQuizQuestion[] }>(
  quizzes: T[],
  query: string,
) {
  return quizzes.filter((quiz) =>
    quiz.quiz.some((question) =>
      matchesSearchQuery(query, [question.question, question.explanation]),
    ),
  );
}

export function filterFlashcardsForSearch<
  T extends { question: string; answer: string },
>(flashcards: T[], query: string) {
  return flashcards.filter((flashcard) =>
    matchesSearchQuery(query, [flashcard.question, flashcard.answer]),
  );
}

export function filterReviewItemsForSearch<T extends SearchableReviewItem>(
  items: T[],
  query: string,
) {
  return items.filter((item) => matchesSearchQuery(query, item.searchableText));
}

function getExcerpt(value: string) {
  const normalizedValue = value.replace(/\s+/g, " ").trim();

  if (normalizedValue.length <= 120) {
    return normalizedValue;
  }

  return `${normalizedValue.slice(0, 117)}...`;
}

function getQuizSearchText(quiz: SearchableQuiz) {
  return quiz.quiz
    .map((question) =>
      [question.question, question.answer, question.explanation]
        .filter(Boolean)
        .join(" "),
    )
    .join(" ");
}

export function buildKeywordSearchResults<
  TDocument extends SearchableDocument,
  TNote extends SearchableNote & { documentTitle?: string },
  TQuiz extends SearchableQuiz,
  TFlashcard extends SearchableFlashcard,
>({
  query,
  documents,
  notes,
  quizzes,
  flashcards,
}: {
  query: string;
  documents: TDocument[];
  notes: TNote[];
  quizzes: TQuiz[];
  flashcards: TFlashcard[];
}): SemanticSearchResult[] {
  const normalizedQuery = normalizeSearchQuery(query);

  if (!normalizedQuery) {
    return [];
  }

  const documentResults = filterDocumentsForSearch(documents, query).map(
    (document): SemanticSearchResult => ({
      id: document.id,
      type: "document",
      title: document.fileName,
      href: document.href,
      similarity: null,
      relevancePercent: null,
      excerpt: "Open document workspace",
    }),
  );
  const noteResults = filterNotesForSearch(notes, query).map(
    (note): SemanticSearchResult => ({
      id: note.id,
      type: "note",
      title: note.title ?? note.documentTitle ?? "Untitled note",
      href: note.href,
      similarity: null,
      relevancePercent: null,
      excerpt: getExcerpt(note.content),
    }),
  );
  const quizResults = filterQuizzesForSearch(quizzes, query).map(
    (quiz): SemanticSearchResult => ({
      id: quiz.id,
      type: "quiz",
      title: quiz.title ?? quiz.documentTitle ?? "Saved quiz",
      href: quiz.href,
      similarity: null,
      relevancePercent: null,
      excerpt: getExcerpt(getQuizSearchText(quiz) || "Saved quiz"),
    }),
  );
  const flashcardResults = filterFlashcardsForSearch(flashcards, query).map(
    (flashcard): SemanticSearchResult => ({
      id: flashcard.id,
      type: "flashcard",
      title: flashcard.question,
      href: flashcard.href,
      similarity: null,
      relevancePercent: null,
      excerpt: getExcerpt(flashcard.answer),
    }),
  );

  return [
    ...documentResults,
    ...noteResults,
    ...quizResults,
    ...flashcardResults,
  ];
}

export function buildGlobalSearchResults<
  TDocument extends SearchableDocument,
  TNote extends SearchableNote,
  TQuiz extends SearchableQuiz,
>({
  query,
  documents,
  notes,
  quizzes,
}: {
  query: string;
  documents: TDocument[];
  notes: TNote[];
  quizzes: TQuiz[];
}) {
  const filteredDocuments = filterDocumentsForSearch(documents, query);
  const filteredNotes = filterNotesForSearch(notes, query);
  const filteredQuizzes = filterQuizzesForSearch(quizzes, query);

  return {
    documents: filteredDocuments,
    notes: filteredNotes,
    quizzes: filteredQuizzes,
    totalCount:
      filteredDocuments.length + filteredNotes.length + filteredQuizzes.length,
  };
}
