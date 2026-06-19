import { NextResponse } from "next/server.js";
import {
  buildQuizExcerpts,
  hasWeaknessActivity,
} from "./weakness-detection.ts";
import type {
  WeaknessDetectionActivity,
  WeakTopic,
} from "./weakness-detection.ts";

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

type WeaknessDetectionRouteDependencies = {
  createClient(): Promise<RouteSupabaseClient>;
  generateWeaknesses(activity: WeaknessDetectionActivity): Promise<WeakTopic[]>;
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

type WeaknessDocumentRow = {
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
    throw new Error(`Unable to load weakness chats: ${error.message}`);
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
    throw new Error(`Unable to load weakness notes: ${error.message}`);
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
    throw new Error(`Unable to load weakness quizzes: ${error.message}`);
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
    data: WeaknessDocumentRow[] | null;
    error: {
      message: string;
    } | null;
  };

  if (error) {
    throw new Error(`Unable to load weakness document titles: ${error.message}`);
  }

  return new Map(
    (data ?? []).map((document) => [document.id, document.file_name]),
  );
}

async function loadWeaknessDetectionActivity(
  supabase: RouteSupabaseClient,
  userId: string,
): Promise<WeaknessDetectionActivity> {
  const [chatRows, noteRows, quizRows] = await Promise.all([
    loadRecentChats(supabase, userId),
    loadRecentNotes(supabase, userId),
    loadRecentQuizzes(supabase, userId),
  ]);
  const documentIds = [
    ...chatRows.map((chat) => chat.document_id),
    ...noteRows.map((note) => note.document_id),
    ...quizRows.map((quiz) => quiz.document_id),
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
  };
}

export function createWeaknessDetectionRoute(
  dependencies: WeaknessDetectionRouteDependencies,
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
      const activity = await loadWeaknessDetectionActivity(supabase, user.id);

      if (!hasWeaknessActivity(activity)) {
        return NextResponse.json({
          weakTopics: [],
        });
      }

      const weakTopics = await dependencies.generateWeaknesses(activity);

      return NextResponse.json({
        weakTopics,
      });
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Unknown weakness detection error.",
        },
        { status: 500 },
      );
    }
  }

  return {
    POST,
  };
}
