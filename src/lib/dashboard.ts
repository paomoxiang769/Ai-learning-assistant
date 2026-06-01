import { normalizeStoredStudyQuizPayload } from "./study-quiz-types.ts";

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

export type DashboardOverview = {
  totalDocuments: number;
  processedDocuments: number;
  totalSavedQuizzes: number;
  totalChatMessages: number;
  recentDocuments: DashboardRecentDocument[];
  recentQuizzes: DashboardRecentQuiz[];
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

    const { count, error } = (await builder) as {
      count: number | null;
      error: {
        message: string;
      } | null;
      data: DocumentCountRow[] | null;
    };

    if (error) {
      console.error(
        `Dashboard warning: unable to load ${query.label}; using 0.`,
        error,
      );
      return 0;
    }

    return count ?? 0;
  } catch (error) {
    console.error(
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

export async function loadDashboardOverview({
  supabase,
  userId,
}: {
  supabase: DashboardSupabaseClient;
  userId: string;
}): Promise<DashboardOverview> {
  const [
    totalDocuments,
    processedDocuments,
    totalSavedQuizzes,
    totalChatMessages,
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
    loadRecentDocuments(supabase, userId),
    loadRecentQuizzes(supabase, userId),
  ]);

  return {
    totalDocuments,
    processedDocuments,
    totalSavedQuizzes,
    totalChatMessages,
    recentDocuments,
    recentQuizzes,
  };
}
