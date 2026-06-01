import Link from "next/link";
import { redirect } from "next/navigation";
import { AiReviewCard } from "./ai-review-card";
import { loadDashboardOverview } from "@/lib/dashboard";
import { createClient } from "@/lib/supabase/server";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const overview = await loadDashboardOverview({
    supabase,
    userId: user.id,
  });

  return (
    <main className="page">
      <section className="page-header">
        <p className="eyebrow">Dashboard</p>
        <h1>Learning progress</h1>
        <p>Signed in as {user.email}</p>
      </section>

      <section className="grid grid-3" aria-label="Dashboard stats">
        <article className="card">
          <h2>Total documents</h2>
          <p>{overview.totalDocuments}</p>
        </article>
        <article className="card">
          <h2>Processed documents</h2>
          <p>{overview.processedDocuments}</p>
        </article>
        <article className="card">
          <h2>Total saved quizzes</h2>
          <p>{overview.totalSavedQuizzes}</p>
        </article>
        <article className="card">
          <h2>Total chat messages</h2>
          <p>{overview.totalChatMessages}</p>
        </article>
        <article className="card">
          <h2>Total notes</h2>
          <p>{overview.totalNotes}</p>
        </article>
      </section>

      <section className="grid grid-3 parsed-text-section" aria-label="Study analytics">
        <article className="card">
          <h2>Most studied document</h2>
          {overview.mostStudiedDocument ? (
            <>
              <p>{overview.mostStudiedDocument.title}</p>
              <p>Score: {overview.mostStudiedDocument.score}</p>
              <div className="button-row">
                <Link
                  className="button secondary"
                  href={overview.mostStudiedDocument.href}
                >
                  Open
                </Link>
              </div>
            </>
          ) : (
            <p>No study activity yet</p>
          )}
        </article>
        <article className="card">
          <h2>Study activity summary</h2>
          <p>Chats: {overview.studyActivitySummary.chats}</p>
          <p>Quizzes: {overview.studyActivitySummary.quizzes}</p>
          <p>Notes: {overview.studyActivitySummary.notes}</p>
        </article>
      </section>

      <section className="parsed-text-section" aria-label="AI Review">
        <AiReviewCard />
      </section>

      <section className="list-section parsed-text-section" aria-label="Recent documents">
        <div className="section-heading">
          <h2>Recent documents</h2>
          <p>Latest 5 uploads</p>
        </div>

        {overview.recentDocuments.length === 0 ? (
          <article className="card">
            <h2>No recent documents</h2>
            <p>Your latest uploaded documents will appear here.</p>
          </article>
        ) : (
          <div className="list">
            {overview.recentDocuments.map((document) => (
              <article className="list-item" key={document.id}>
                <div>
                  <h2>{document.fileName}</h2>
                  <p>
                    {document.processingStatus} - Uploaded{" "}
                    {formatDateTime(document.createdAt)}
                  </p>
                </div>
                <div className="list-item-actions">
                  <Link className="button secondary" href={document.href}>
                    View detail
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="list-section parsed-text-section" aria-label="Recent quizzes">
        <div className="section-heading">
          <h2>Recent quizzes</h2>
          <p>Latest 5 saved quizzes</p>
        </div>

        {overview.recentQuizzes.length === 0 ? (
          <article className="card">
            <h2>No recent quizzes</h2>
            <p>Your saved quiz history will appear here.</p>
          </article>
        ) : (
          <div className="list">
            {overview.recentQuizzes.map((quiz) => (
              <article className="list-item" key={quiz.id}>
                <div>
                  <h2>{quiz.documentTitle}</h2>
                  <p>
                    {quiz.questionCount} questions - Saved{" "}
                    {formatDateTime(quiz.createdAt)}
                  </p>
                </div>
                <div className="list-item-actions">
                  <Link className="button secondary" href={quiz.href}>
                    Continue quiz
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <form className="button-row" action="/api/auth" method="post">
        <button
          className="button secondary"
          name="auth_action"
          value="logout"
          type="submit"
        >
          Logout
        </button>
      </form>
    </main>
  );
}
