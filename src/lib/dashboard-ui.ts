import type {
  DashboardRecentDocument,
  DashboardRecentQuiz,
  DashboardStudyActivitySummary,
} from "./dashboard";

export type DashboardActivityFeedItem = {
  id: string;
  label: string;
  title: string;
  meta: string;
  href: string;
};

type DashboardActivityFeedInput = {
  recentDocuments: DashboardRecentDocument[];
  recentQuizzes: DashboardRecentQuiz[];
  studyActivitySummary: DashboardStudyActivitySummary;
};

function pluralize(value: number, singular: string, plural: string) {
  return value === 1 ? singular : plural;
}

function formatStatus(status: DashboardRecentDocument["processingStatus"]) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function buildDashboardActivityFeed({
  recentDocuments,
  recentQuizzes,
  studyActivitySummary,
}: DashboardActivityFeedInput): DashboardActivityFeedItem[] {
  const feed: DashboardActivityFeedItem[] = [];

  for (const quiz of recentQuizzes.slice(0, 2)) {
    feed.push({
      id: `quiz-${quiz.id}`,
      label: "Created quiz",
      title: quiz.documentTitle,
      meta: `${quiz.questionCount} ${pluralize(
        quiz.questionCount,
        "question",
        "questions",
      )}`,
      href: quiz.href,
    });
  }

  if (studyActivitySummary.chats > 0) {
    feed.push({
      id: "chat-summary",
      label: "Asked questions",
      title: `${studyActivitySummary.chats} chat ${pluralize(
        studyActivitySummary.chats,
        "message",
        "messages",
      )} this week`,
      meta: "Recent document study chats",
      href: "/chat",
    });
  }

  if (studyActivitySummary.notes > 0) {
    feed.push({
      id: "note-summary",
      label: "Added notes",
      title: `${studyActivitySummary.notes} ${pluralize(
        studyActivitySummary.notes,
        "note",
        "notes",
      )} this week`,
      meta: "Saved study observations",
      href: "/review",
    });
  }

  for (const document of recentDocuments.slice(0, 2)) {
    feed.push({
      id: `document-${document.id}`,
      label: "Uploaded document",
      title: document.fileName,
      meta: formatStatus(document.processingStatus),
      href: document.href,
    });
  }

  return feed.slice(0, 5);
}
