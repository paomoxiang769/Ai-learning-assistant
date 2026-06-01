import { normalizeStoredStudyQuizPayload } from "./study-quiz-types.ts";

type ReviewCenterSupabaseClient = {
  from(table: string): any;
};

type RecentChatRow = {
  id: string;
  document_id: string;
  content: string;
  created_at: string;
};

type RecentQuizRow = {
  id: string;
  document_id: string;
  quiz_json: unknown;
  created_at: string;
};

type RecentNoteRow = {
  id: string;
  document_id: string;
  title: string | null;
  note_type: "ai_summary" | "manual";
  created_at: string;
};

type ReviewDocumentRow = {
  id: string;
  file_name: string;
};

export type ReviewCenterRecentChat = {
  id: string;
  documentId: string;
  documentTitle: string;
  excerpt: string;
  createdAt: string;
  href: string;
};

export type ReviewCenterRecentQuiz = {
  id: string;
  documentId: string;
  documentTitle: string;
  questionCount: number;
  createdAt: string;
  href: string;
};

export type ReviewCenterRecentNote = {
  id: string;
  documentId: string;
  documentTitle: string;
  noteType: "ai_summary" | "manual";
  title: string | null;
  createdAt: string;
  href: string;
};

export type ReviewCenterOverview = {
  recentChats: ReviewCenterRecentChat[];
  recentQuizzes: ReviewCenterRecentQuiz[];
  recentNotes: ReviewCenterRecentNote[];
};

function getExcerpt(content: string) {
  const normalized = content.replace(/\s+/g, " ").trim();

  if (normalized.length <= 180) {
    return normalized;
  }

  return `${normalized.slice(0, 177)}...`;
}

async function loadRecentChats(
  supabase: ReviewCenterSupabaseClient,
  userId: string,
) {
  const { data, error } = (await supabase
    .from("document_chat_messages")
    .select("id, document_id, content, created_at")
    .eq("user_id", userId)
    .eq("role", "assistant")
    .order("created_at", { ascending: false })
    .limit(10)) as {
    data: RecentChatRow[] | null;
    error: {
      message: string;
    } | null;
  };

  if (error) {
    throw new Error(`Unable to load recent chats: ${error.message}`);
  }

  return data ?? [];
}

async function loadRecentQuizzes(
  supabase: ReviewCenterSupabaseClient,
  userId: string,
) {
  const { data, error } = (await supabase
    .from("document_quizzes")
    .select("id, document_id, quiz_json, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(10)) as {
    data: RecentQuizRow[] | null;
    error: {
      message: string;
    } | null;
  };

  if (error) {
    throw new Error(`Unable to load recent quizzes: ${error.message}`);
  }

  return data ?? [];
}

async function loadRecentNotes(
  supabase: ReviewCenterSupabaseClient,
  userId: string,
) {
  const { data, error } = (await supabase
    .from("document_notes")
    .select("id, document_id, title, note_type, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(10)) as {
    data: RecentNoteRow[] | null;
    error: {
      message: string;
    } | null;
  };

  if (error) {
    throw new Error(`Unable to load recent notes: ${error.message}`);
  }

  return data ?? [];
}

async function loadDocumentTitles(
  supabase: ReviewCenterSupabaseClient,
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
    data: ReviewDocumentRow[] | null;
    error: {
      message: string;
    } | null;
  };

  if (error) {
    throw new Error(`Unable to load review document titles: ${error.message}`);
  }

  return new Map(
    (data ?? []).map((document) => [document.id, document.file_name]),
  );
}

export async function loadReviewCenter({
  supabase,
  userId,
}: {
  supabase: ReviewCenterSupabaseClient;
  userId: string;
}): Promise<ReviewCenterOverview> {
  const [chatRows, quizRows, noteRows] = await Promise.all([
    loadRecentChats(supabase, userId),
    loadRecentQuizzes(supabase, userId),
    loadRecentNotes(supabase, userId),
  ]);
  const documentTitleById = await loadDocumentTitles(
    supabase,
    userId,
    [
      ...chatRows.map((chat) => chat.document_id),
      ...quizRows.map((quiz) => quiz.document_id),
      ...noteRows.map((note) => note.document_id),
    ],
  );

  return {
    recentChats: chatRows.map((chat) => ({
      id: chat.id,
      documentId: chat.document_id,
      documentTitle: documentTitleById.get(chat.document_id) ?? chat.document_id,
      excerpt: getExcerpt(chat.content),
      createdAt: chat.created_at,
      href: `/documents/${chat.document_id}`,
    })),
    recentQuizzes: quizRows.map((quiz) => ({
      id: quiz.id,
      documentId: quiz.document_id,
      documentTitle: documentTitleById.get(quiz.document_id) ?? quiz.document_id,
      questionCount: normalizeStoredStudyQuizPayload(quiz.quiz_json).length,
      createdAt: quiz.created_at,
      href: `/documents/${quiz.document_id}?quizId=${encodeURIComponent(quiz.id)}`,
    })),
    recentNotes: noteRows.map((note) => ({
      id: note.id,
      documentId: note.document_id,
      documentTitle: documentTitleById.get(note.document_id) ?? note.document_id,
      noteType: note.note_type,
      title: note.title,
      createdAt: note.created_at,
      href: `/documents/${note.document_id}?noteId=${encodeURIComponent(note.id)}`,
    })),
  };
}
