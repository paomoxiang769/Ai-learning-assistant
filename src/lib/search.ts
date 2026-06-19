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

export type SearchableReviewItem = {
  searchableText: string[];
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

export function filterReviewItemsForSearch<T extends SearchableReviewItem>(
  items: T[],
  query: string,
) {
  return items.filter((item) => matchesSearchQuery(query, item.searchableText));
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
