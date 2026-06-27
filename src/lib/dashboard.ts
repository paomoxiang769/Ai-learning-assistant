import { normalizeStoredStudyQuizPayload } from "./study-quiz-types.ts";
import type {
  SearchableDocument,
  SearchableFlashcard,
  SearchableNote,
  SearchableQuiz,
} from "./search.ts";

type DashboardSupabaseClient = {
  from(table: string): any;
};

type DashboardCountQuery = {
  table: string;
  label: string;
  filters?: Array<{
    column: string;
    value: string;
  }>;
  gteFilters?: Array<{
    column: string;
    value: string;
  }>;
};

type DocumentCountRow = {
  id: string;
};

type DashboardDocumentRow = {
  id: string;
  file_name: string;
  processing_status: "pending" | "completed" | "failed";
  created_at: string;
};

type DashboardQuizRow = {
  id: string;
  document_id: string;
  quiz_json: unknown;
  created_at: string;
};

type DashboardQuizDocumentRow = {
  id: string;
  file_name: string;
};

type DashboardSearchNoteRow = {
  id: string;
  document_id: string;
  title: string | null;
  content: string;
  created_at: string;
};

type DashboardSearchQuizRow = {
  id: string;
  document_id: string;
  title: string | null;
  quiz_json: unknown;
  created_at: string;
};

type DashboardSearchFlashcardRow = {
  id: string;
  document_id: string;
  question: string;
  answer: string;
  created_at: string;
};

type DashboardActivityRow = {
  document_id: string;
};

export type DashboardRecentDocument = {
  id: string;
  fileName: string;
  processingStatus: "pending" | "completed" | "failed";
  createdAt: string;
  href: string;
};

export type DashboardRecentQuiz = {
  id: string;
  documentId: string;
  documentTitle: string;
  questionCount: number;
  createdAt: string;
  href: string;
};

export type DashboardMostStudiedDocument = {
  id: string;
  title: string;
  score: number;
  href: string;
};

export type DashboardStudyActivitySummary = {
  chats: number;
  quizzes: number;
  notes: number;
  flashcards: number;
};

export type DashboardOverview = {
  totalDocuments: number;
  processedDocuments: number;
  totalSavedQuizzes: number;
  totalChatMessages: number;
  totalNotes: number;
  totalFlashcards: number;
  mostStudiedDocument: DashboardMostStudiedDocument | null;
  studyActivitySummary: DashboardStudyActivitySummary;
  recentDocuments: DashboardRecentDocument[];
  recentQuizzes: DashboardRecentQuiz[];
};

export type DashboardSearchDocument = SearchableDocument & {
  createdAt: string;
};

export type DashboardSearchNote = SearchableNote & {
  documentId: string;
  documentTitle: string;
  createdAt: string;
};

export type DashboardSearchQuiz = SearchableQuiz & {
  documentId: string;
  documentTitle: string;
  createdAt: string;
  questionCount: number;
};

export type DashboardSearchFlashcard = SearchableFlashcard & {
  createdAt: string;
};

export type DashboardSearchData = {
  documents: DashboardSearchDocument[];
  notes: DashboardSearchNote[];
  quizzes: DashboardSearchQuiz[];
  flashcards: DashboardSearchFlashcard[];
};

async function loadCount(
  supabase: DashboardSupabaseClient,
  query: DashboardCountQuery,
  userId: string,
): Promise<number> {
  try {
    let builder = supabase
      .from(query.table)
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    for (const filter of query.filters ?? []) {
      builder = builder.eq(filter.column, filter.value);
    }

    for (const filter of query.gteFilters ?? []) {
      builder = builder.gte(filter.column, filter.value);
    }

    const { count, error } = (await builder) as {
      count: number | null;
      error: {
        message: string;
      } | null;
      data: DocumentCountRow[] | null;
    };

    if (error) {
      console.warn(
        `Dashboard warning: unable to load ${query.label}; using 0.`,
        error,
      );
      return 0;
    }

    return count ?? 0;
  } catch (error) {
    console.warn(
      `Dashboard warning: unable to load ${query.label}; using 0.`,
      error,
    );
    return 0;
  }
}

async function loadRecentDocuments(
  supabase: DashboardSupabaseClient,
  userId: string,
) {
  const { data, error } = (await supabase
    .from("documents")
    .select("id, file_name, processing_status, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(5)) as {
    data: DashboardDocumentRow[] | null;
    error: {
      message: string;
    } | null;
  };

  if (error) {
    throw new Error(`Unable to load recent documents: ${error.message}`);
  }

  return (data ?? []).map((document) => ({
    id: document.id,
    fileName: document.file_name,
    processingStatus: document.processing_status,
    createdAt: document.created_at,
    href: `/documents/${document.id}`,
  })) satisfies DashboardRecentDocument[];
}

async function loadRecentQuizzes(
  supabase: DashboardSupabaseClient,
  userId: string,
) {
  const { data, error } = (await supabase
    .from("document_quizzes")
    .select("id, document_id, quiz_json, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(5)) as {
    data: DashboardQuizRow[] | null;
    error: {
      message: string;
    } | null;
  };

  if (error) {
    throw new Error(`Unable to load recent quizzes: ${error.message}`);
  }

  const quizRows = data ?? [];

  if (quizRows.length === 0) {
    return [];
  }

  const documentIds = [...new Set(quizRows.map((quiz) => quiz.document_id))];
  const { data: documentRows, error: documentError } = (await supabase
    .from("documents")
    .select("id, file_name")
    .eq("user_id", userId)
    .in("id", documentIds)) as {
    data: DashboardQuizDocumentRow[] | null;
    error: {
      message: string;
    } | null;
  };

  if (documentError) {
    throw new Error(
      `Unable to load recent quiz document titles: ${documentError.message}`,
    );
  }

  const titleById = new Map(
    (documentRows ?? []).map((document) => [document.id, document.file_name]),
  );

  return quizRows.map((quiz) => ({
    id: quiz.id,
    documentId: quiz.document_id,
    documentTitle: titleById.get(quiz.document_id) ?? quiz.document_id,
    questionCount: normalizeStoredStudyQuizPayload(quiz.quiz_json).length,
    createdAt: quiz.created_at,
    href: `/documents/${quiz.document_id}?quizId=${encodeURIComponent(quiz.id)}`,
  })) satisfies DashboardRecentQuiz[];
}

function getSevenDayCutoff(now: Date) {
  const sevenDaysInMilliseconds = 7 * 24 * 60 * 60 * 1000;
  return new Date(now.getTime() - sevenDaysInMilliseconds).toISOString();
}

async function loadStudyActivitySummary(
  supabase: DashboardSupabaseClient,
  userId: string,
  now: Date,
): Promise<DashboardStudyActivitySummary> {
  const cutoff = getSevenDayCutoff(now);
  const [chats, quizzes, notes, flashcards] = await Promise.all([
    loadCount(
      supabase,
      {
        table: "document_chat_messages",
        label: "recent chat activity count",
        gteFilters: [
          {
            column: "created_at",
            value: cutoff,
          },
        ],
      },
      userId,
    ),
    loadCount(
      supabase,
      {
        table: "document_quizzes",
        label: "recent quiz activity count",
        gteFilters: [
          {
            column: "created_at",
            value: cutoff,
          },
        ],
      },
      userId,
    ),
    loadCount(
      supabase,
      {
        table: "document_notes",
        label: "recent note activity count",
        gteFilters: [
          {
            column: "created_at",
            value: cutoff,
          },
        ],
      },
      userId,
    ),
    loadCount(
      supabase,
      {
        table: "document_flashcards",
        label: "recent flashcard activity count",
        gteFilters: [
          {
            column: "created_at",
            value: cutoff,
          },
        ],
      },
      userId,
    ),
  ]);

  return {
    chats,
    quizzes,
    notes,
    flashcards,
  };
}

async function loadDocumentActivityRows(
  supabase: DashboardSupabaseClient,
  table: string,
  label: string,
  userId: string,
) {
  try {
    const { data, error } = (await supabase
      .from(table)
      .select("document_id")
      .eq("user_id", userId)) as {
      data: DashboardActivityRow[] | null;
      error: {
        message: string;
      } | null;
    };

    if (error) {
      console.warn(
        `Dashboard warning: unable to load ${label}; using empty activity.`,
        error,
      );
      return [];
    }

    return data ?? [];
  } catch (error) {
    console.warn(
      `Dashboard warning: unable to load ${label}; using empty activity.`,
      error,
    );
    return [];
  }
}

async function loadMostStudiedDocument(
  supabase: DashboardSupabaseClient,
  userId: string,
): Promise<DashboardMostStudiedDocument | null> {
  const [chatRows, quizRows, noteRows, flashcardRows] = await Promise.all([
    loadDocumentActivityRows(
      supabase,
      "document_chat_messages",
      "chat activity rows",
      userId,
    ),
    loadDocumentActivityRows(
      supabase,
      "document_quizzes",
      "quiz activity rows",
      userId,
    ),
    loadDocumentActivityRows(
      supabase,
      "document_notes",
      "note activity rows",
      userId,
    ),
    loadDocumentActivityRows(
      supabase,
      "document_flashcards",
      "flashcard activity rows",
      userId,
    ),
  ]);

  const scoreByDocumentId = new Map<string, number>();

  for (const row of [...chatRows, ...quizRows, ...noteRows, ...flashcardRows]) {
    scoreByDocumentId.set(
      row.document_id,
      (scoreByDocumentId.get(row.document_id) ?? 0) + 1,
    );
  }

  const documentIds = [...scoreByDocumentId.keys()];

  if (documentIds.length === 0) {
    return null;
  }

  const { data, error } = (await supabase
    .from("documents")
    .select("id, file_name")
    .eq("user_id", userId)
    .in("id", documentIds)) as {
    data: DashboardQuizDocumentRow[] | null;
    error: {
      message: string;
    } | null;
  };

  if (error) {
    console.warn(
      "Dashboard warning: unable to load most studied document title; using empty activity.",
      error,
    );
    return null;
  }

  const documentRows = data ?? [];
  const mostStudiedDocument = documentRows
    .map((document) => ({
      id: document.id,
      title: document.file_name,
      score: scoreByDocumentId.get(document.id) ?? 0,
      href: `/documents/${document.id}`,
    }))
    .sort((first, second) => {
      if (second.score !== first.score) {
        return second.score - first.score;
      }

      const titleComparison = first.title.localeCompare(second.title);
      return titleComparison === 0
        ? first.id.localeCompare(second.id)
        : titleComparison;
    })[0];

  return mostStudiedDocument ?? null;
}

export async function loadDashboardOverview({
  supabase,
  userId,
  now = new Date(),
}: {
  supabase: DashboardSupabaseClient;
  userId: string;
  now?: Date;
}): Promise<DashboardOverview> {
  const [
    totalDocuments,
    processedDocuments,
    totalSavedQuizzes,
    totalChatMessages,
    totalNotes,
    totalFlashcards,
    studyActivitySummary,
    recentDocuments,
    recentQuizzes,
  ] = await Promise.all([
    loadCount(
      supabase,
      {
        table: "documents",
        label: "document count",
      },
      userId,
    ),
    loadCount(
      supabase,
      {
        table: "documents",
        label: "processed document count",
        filters: [
          {
            column: "processing_status",
            value: "completed",
          },
        ],
      },
      userId,
    ),
    loadCount(
      supabase,
      {
        table: "document_quizzes",
        label: "saved quiz count",
      },
      userId,
    ),
    loadCount(
      supabase,
      {
        table: "document_chat_messages",
        label: "chat message count",
      },
      userId,
    ),
    loadCount(
      supabase,
      {
        table: "document_notes",
        label: "note count",
      },
      userId,
    ),
    loadCount(
      supabase,
      {
        table: "document_flashcards",
        label: "flashcard count",
      },
      userId,
    ),
    loadStudyActivitySummary(supabase, userId, now),
    loadRecentDocuments(supabase, userId),
    loadRecentQuizzes(supabase, userId),
  ]);

  const mostStudiedDocument = await loadMostStudiedDocument(supabase, userId);

  return {
    totalDocuments,
    processedDocuments,
    totalSavedQuizzes,
    totalChatMessages,
    totalNotes,
    totalFlashcards,
    mostStudiedDocument,
    studyActivitySummary,
    recentDocuments,
    recentQuizzes,
  };
}

async function loadDocumentTitleMap(
  supabase: DashboardSupabaseClient,
  userId: string,
  documentIds: string[],
) {
  const uniqueDocumentIds = [...new Set(documentIds)];

  if (uniqueDocumentIds.length === 0) {
    return new Map<string, string>();
  }

  const { data, error } = (await supabase
    .from("documents")
    .select("id, file_name")
    .eq("user_id", userId)
    .in("id", uniqueDocumentIds)) as {
    data: DashboardQuizDocumentRow[] | null;
    error: {
      message: string;
    } | null;
  };

  if (error) {
    throw new Error(`Unable to load search document titles: ${error.message}`);
  }

  return new Map(
    (data ?? []).map((document) => [document.id, document.file_name]),
  );
}

export async function loadDashboardSearchData({
  supabase,
  userId,
}: {
  supabase: DashboardSupabaseClient;
  userId: string;
}): Promise<DashboardSearchData> {
  const [documentQuery, noteQuery, quizQuery, flashcardQuery] = await Promise.all([
    (await supabase
      .from("documents")
      .select("id, file_name, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })) as {
      data: Array<{
        id: string;
        file_name: string;
        created_at: string;
      }> | null;
      error: {
        message: string;
      } | null;
    },
    (await supabase
      .from("document_notes")
      .select("id, document_id, title, content, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })) as {
      data: DashboardSearchNoteRow[] | null;
      error: {
        message: string;
      } | null;
    },
    (await supabase
      .from("document_quizzes")
      .select("id, document_id, title, quiz_json, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })) as {
      data: DashboardSearchQuizRow[] | null;
      error: {
        message: string;
      } | null;
    },
    (await supabase
      .from("document_flashcards")
      .select("id, document_id, question, answer, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })) as {
      data: DashboardSearchFlashcardRow[] | null;
      error: {
        message: string;
      } | null;
    },
  ]);

  if (documentQuery.error) {
    throw new Error(`Unable to load searchable documents: ${documentQuery.error.message}`);
  }

  if (noteQuery.error) {
    throw new Error(`Unable to load searchable notes: ${noteQuery.error.message}`);
  }

  if (quizQuery.error) {
    throw new Error(`Unable to load searchable quizzes: ${quizQuery.error.message}`);
  }

  if (flashcardQuery.error) {
    throw new Error(
      `Unable to load searchable flashcards: ${flashcardQuery.error.message}`,
    );
  }

  const noteRows = noteQuery.data ?? [];
  const quizRows = quizQuery.data ?? [];
  const flashcardRows = flashcardQuery.data ?? [];
  const documentTitleById = await loadDocumentTitleMap(
    supabase,
    userId,
    [
      ...noteRows.map((note) => note.document_id),
      ...quizRows.map((quiz) => quiz.document_id),
      ...flashcardRows.map((flashcard) => flashcard.document_id),
    ],
  );

  return {
    documents: (documentQuery.data ?? []).map((document) => ({
      id: document.id,
      fileName: document.file_name,
      createdAt: document.created_at,
      href: `/documents/${document.id}`,
    })),
    notes: noteRows.map((note) => ({
      id: note.id,
      documentId: note.document_id,
      documentTitle: documentTitleById.get(note.document_id) ?? note.document_id,
      title: note.title,
      content: note.content,
      createdAt: note.created_at,
      href: `/documents/${note.document_id}?noteId=${encodeURIComponent(note.id)}`,
    })),
    quizzes: quizRows.map((quiz) => {
      const normalizedQuiz = normalizeStoredStudyQuizPayload(quiz.quiz_json);

      return {
        id: quiz.id,
        documentId: quiz.document_id,
        documentTitle: documentTitleById.get(quiz.document_id) ?? quiz.document_id,
        title: quiz.title,
        quiz: normalizedQuiz,
        questionCount: normalizedQuiz.length,
        createdAt: quiz.created_at,
        href: `/documents/${quiz.document_id}?quizId=${encodeURIComponent(quiz.id)}`,
      };
    }),
    flashcards: flashcardRows.map((flashcard) => ({
      id: flashcard.id,
      documentId: flashcard.document_id,
      documentTitle:
        documentTitleById.get(flashcard.document_id) ?? flashcard.document_id,
      question: flashcard.question,
      answer: flashcard.answer,
      createdAt: flashcard.created_at,
      href: `/documents/${flashcard.document_id}?flashcardId=${encodeURIComponent(
        flashcard.id,
      )}`,
    })),
  };
}
