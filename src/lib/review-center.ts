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
  title: string | null;
  quiz_json: unknown;
  created_at: string;
};

type RecentNoteRow = {
  id: string;
  document_id: string;
  title: string | null;
  note_type: "ai_summary" | "manual";
  content: string;
  created_at: string;
};

type RecentFlashcardRow = {
  id: string;
  document_id: string;
  question: string;
  answer: string;
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
  searchableText: string[];
};

export type ReviewCenterRecentQuiz = {
  id: string;
  documentId: string;
  documentTitle: string;
  title: string | null;
  questionCount: number;
  createdAt: string;
  href: string;
  searchableText: string[];
};

export type ReviewCenterRecentNote = {
  id: string;
  documentId: string;
  documentTitle: string;
  noteType: "ai_summary" | "manual";
  title: string | null;
  content: string;
  createdAt: string;
  href: string;
  searchableText: string[];
};

export type ReviewCenterRecentFlashcard = {
  id: string;
  documentId: string;
  documentTitle: string;
  question: string;
  answer: string;
  createdAt: string;
  href: string;
  searchableText: string[];
};

export type ReviewCenterOverview = {
  recentChats: ReviewCenterRecentChat[];
  recentQuizzes: ReviewCenterRecentQuiz[];
  recentNotes: ReviewCenterRecentNote[];
  recentFlashcards: ReviewCenterRecentFlashcard[];
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
    .select("id, document_id, title, quiz_json, created_at")
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
    .select("id, document_id, title, note_type, content, created_at")
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

async function loadRecentFlashcards(
  supabase: ReviewCenterSupabaseClient,
  userId: string,
) {
  const { data, error } = (await supabase
    .from("document_flashcards")
    .select("id, document_id, question, answer, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(10)) as {
    data: RecentFlashcardRow[] | null;
    error: {
      message: string;
    } | null;
  };

  if (error) {
    throw new Error(`Unable to load recent flashcards: ${error.message}`);
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
  const [chatRows, quizRows, noteRows, flashcardRows] = await Promise.all([
    loadRecentChats(supabase, userId),
    loadRecentQuizzes(supabase, userId),
    loadRecentNotes(supabase, userId),
    loadRecentFlashcards(supabase, userId),
  ]);
  const documentTitleById = await loadDocumentTitles(
    supabase,
    userId,
    [
      ...chatRows.map((chat) => chat.document_id),
      ...quizRows.map((quiz) => quiz.document_id),
      ...noteRows.map((note) => note.document_id),
      ...flashcardRows.map((flashcard) => flashcard.document_id),
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
      searchableText: [
        documentTitleById.get(chat.document_id) ?? chat.document_id,
        chat.content,
      ],
    })),
    recentQuizzes: quizRows.map((quiz) => {
      const normalizedQuiz = normalizeStoredStudyQuizPayload(quiz.quiz_json);

      return {
        id: quiz.id,
        documentId: quiz.document_id,
        documentTitle: documentTitleById.get(quiz.document_id) ?? quiz.document_id,
        title: quiz.title,
        questionCount: normalizedQuiz.length,
        createdAt: quiz.created_at,
        href: `/documents/${quiz.document_id}?quizId=${encodeURIComponent(quiz.id)}`,
        searchableText: [
          documentTitleById.get(quiz.document_id) ?? quiz.document_id,
          quiz.title ?? "",
          ...normalizedQuiz.flatMap((question) => [
            question.question,
            question.explanation,
          ]),
        ],
      };
    }),
    recentNotes: noteRows.map((note) => ({
      id: note.id,
      documentId: note.document_id,
      documentTitle: documentTitleById.get(note.document_id) ?? note.document_id,
      noteType: note.note_type,
      title: note.title,
      content: note.content,
      createdAt: note.created_at,
      href: `/documents/${note.document_id}?noteId=${encodeURIComponent(note.id)}`,
      searchableText: [
        documentTitleById.get(note.document_id) ?? note.document_id,
        note.title ?? "",
        note.content,
      ],
    })),
    recentFlashcards: flashcardRows.map((flashcard) => ({
      id: flashcard.id,
      documentId: flashcard.document_id,
      documentTitle:
        documentTitleById.get(flashcard.document_id) ?? flashcard.document_id,
      question: flashcard.question,
      answer: flashcard.answer,
      createdAt: flashcard.created_at,
      href: `/documents/${flashcard.document_id}`,
      searchableText: [
        documentTitleById.get(flashcard.document_id) ?? flashcard.document_id,
        flashcard.question,
        flashcard.answer,
      ],
    })),
  };
}
