import { NextResponse } from "next/server.js";
import { buildQuizExcerpts } from "./weakness-detection.ts";
import type { StudyPlanActivity, StudyPlanItem } from "./study-plan.ts";

type RouteSupabaseClient = {
  auth: {
    getUser(): Promise<{
      data: {
        user: {
          id: string;
        } | null;
      };
    }>;
  };
  from(table: string): any;
};

type StudyPlanRouteDependencies = {
  createClient(): Promise<RouteSupabaseClient>;
  generatePlan(activity: StudyPlanActivity): Promise<StudyPlanItem[]>;
};

type RecentChatRow = {
  id: string;
  document_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

type RecentNoteRow = {
  id: string;
  document_id: string;
  title: string | null;
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

type RecentFlashcardRow = {
  id: string;
  document_id: string;
  question: string;
  answer: string;
  created_at: string;
};

type StudyPlanDocumentRow = {
  id: string;
  file_name: string;
};

function getExcerpt(content: string) {
  const normalized = content.replace(/\s+/g, " ").trim();

  if (normalized.length <= 180) {
    return normalized;
  }

  return `${normalized.slice(0, 177)}...`;
}

async function loadRecentChats(
  supabase: RouteSupabaseClient,
  userId: string,
) {
  const { data, error } = (await supabase
    .from("document_chat_messages")
    .select("id, document_id, role, content, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(10)) as {
    data: RecentChatRow[] | null;
    error: {
      message: string;
    } | null;
  };

  if (error) {
    throw new Error(`Unable to load study plan chats: ${error.message}`);
  }

  return data ?? [];
}

async function loadRecentNotes(
  supabase: RouteSupabaseClient,
  userId: string,
) {
  const { data, error } = (await supabase
    .from("document_notes")
    .select("id, document_id, title, content, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(10)) as {
    data: RecentNoteRow[] | null;
    error: {
      message: string;
    } | null;
  };

  if (error) {
    throw new Error(`Unable to load study plan notes: ${error.message}`);
  }

  return data ?? [];
}

async function loadRecentQuizzes(
  supabase: RouteSupabaseClient,
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
    throw new Error(`Unable to load study plan quizzes: ${error.message}`);
  }

  return data ?? [];
}

async function loadRecentFlashcards(
  supabase: RouteSupabaseClient,
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
    throw new Error(`Unable to load study plan flashcards: ${error.message}`);
  }

  return data ?? [];
}

async function loadDocumentTitles(
  supabase: RouteSupabaseClient,
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
    data: StudyPlanDocumentRow[] | null;
    error: {
      message: string;
    } | null;
  };

  if (error) {
    throw new Error(`Unable to load study plan document titles: ${error.message}`);
  }

  return new Map(
    (data ?? []).map((document) => [document.id, document.file_name]),
  );
}

function getMostStudiedDocumentTitle(
  documentIds: string[],
  documentTitleById: Map<string, string>,
) {
  const scoreByDocumentId = new Map<string, number>();

  for (const documentId of documentIds) {
    scoreByDocumentId.set(
      documentId,
      (scoreByDocumentId.get(documentId) ?? 0) + 1,
    );
  }

  return [...scoreByDocumentId.entries()]
    .map(([documentId, score]) => ({
      documentId,
      score,
      title: documentTitleById.get(documentId) ?? documentId,
    }))
    .sort((first, second) => {
      if (second.score !== first.score) {
        return second.score - first.score;
      }

      const titleComparison = first.title.localeCompare(second.title);
      return titleComparison === 0
        ? first.documentId.localeCompare(second.documentId)
        : titleComparison;
    })[0]?.title;
}

function hasStudyPlanActivity(activity: StudyPlanActivity) {
  return (
    activity.recentChats.length > 0 ||
    activity.recentNotes.length > 0 ||
    activity.recentQuizzes.length > 0 ||
    activity.recentFlashcards.length > 0
  );
}

async function loadStudyPlanActivity(
  supabase: RouteSupabaseClient,
  userId: string,
): Promise<StudyPlanActivity> {
  const [chatRows, noteRows, quizRows, flashcardRows] = await Promise.all([
    loadRecentChats(supabase, userId),
    loadRecentNotes(supabase, userId),
    loadRecentQuizzes(supabase, userId),
    loadRecentFlashcards(supabase, userId),
  ]);
  const documentIds = [
    ...chatRows.map((chat) => chat.document_id),
    ...noteRows.map((note) => note.document_id),
    ...quizRows.map((quiz) => quiz.document_id),
    ...flashcardRows.map((flashcard) => flashcard.document_id),
  ];
  const documentTitleById = await loadDocumentTitles(
    supabase,
    userId,
    documentIds,
  );

  return {
    recentChats: chatRows.map((chat) => ({
      documentTitle: documentTitleById.get(chat.document_id) ?? chat.document_id,
      role: chat.role,
      excerpt: getExcerpt(chat.content),
      createdAt: chat.created_at,
    })),
    recentNotes: noteRows.map((note) => ({
      documentTitle: documentTitleById.get(note.document_id) ?? note.document_id,
      title: note.title,
      excerpt: getExcerpt(note.content),
      createdAt: note.created_at,
    })),
    recentQuizzes: quizRows.map((quiz) => ({
      documentTitle: documentTitleById.get(quiz.document_id) ?? quiz.document_id,
      title: quiz.title,
      excerpts: buildQuizExcerpts(quiz.quiz_json),
      createdAt: quiz.created_at,
    })),
    recentFlashcards: flashcardRows.map((flashcard) => ({
      documentTitle:
        documentTitleById.get(flashcard.document_id) ?? flashcard.document_id,
      question: getExcerpt(flashcard.question),
      answer: getExcerpt(flashcard.answer),
      createdAt: flashcard.created_at,
    })),
    signals: {
      recentChatsCount: chatRows.length,
      recentQuizzesCount: quizRows.length,
      recentNotesCount: noteRows.length,
      recentFlashcardsCount: flashcardRows.length,
      mostStudiedDocumentTitle: getMostStudiedDocumentTitle(
        documentIds,
        documentTitleById,
      ),
    },
  };
}

export function createStudyPlanRoute(
  dependencies: StudyPlanRouteDependencies,
) {
  async function POST() {
    const supabase = await dependencies.createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    try {
      const activity = await loadStudyPlanActivity(supabase, user.id);

      if (!hasStudyPlanActivity(activity)) {
        return NextResponse.json({
          plan: [],
        });
      }

      const plan = await dependencies.generatePlan(activity);

      return NextResponse.json({
        plan,
      });
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Unknown study plan error.",
        },
        { status: 500 },
      );
    }
  }

  return {
    POST,
  };
}
