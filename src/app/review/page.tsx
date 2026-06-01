import Link from "next/link";
import { redirect } from "next/navigation";
import { loadReviewCenter } from "@/lib/review-center";
import { createClient } from "@/lib/supabase/server";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getNoteTypeLabel(noteType: "ai_summary" | "manual") {
  return noteType === "ai_summary" ? "AI notes" : "Manual";
}

export default async function ReviewCenterPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const reviewCenter = await loadReviewCenter({
    supabase,
    userId: user.id,
  });

  return (
    <main className="page">
      <section className="page-header">
        <p className="eyebrow">Review Center</p>
        <h1>Unified study history</h1>
        <p>Review recent chats, quizzes, and notes in one place.</p>
      </section>

      <section className="list-section parsed-text-section" aria-label="Recent chats">
        <div className="section-heading">
          <h2>Recent Chats</h2>
          <p>Latest 10 assistant replies</p>
        </div>

        {reviewCenter.recentChats.length === 0 ? (
          <article className="card">
            <h2>No recent chats</h2>
            <p>Your assistant chat history will appear here.</p>
          </article>
        ) : (
          <div className="list">
            {reviewCenter.recentChats.map((chat) => (
              <article className="list-item" key={chat.id}>
                <div>
                  <h2>{chat.documentTitle}</h2>
                  <p className="raw-text-preview">{chat.excerpt}</p>
                  <p>Created {formatDateTime(chat.createdAt)}</p>
                </div>
                <div className="list-item-actions">
                  <Link className="button secondary" href={chat.href}>
                    Continue Chat
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="list-section parsed-text-section" aria-label="Recent quizzes">
        <div className="section-heading">
          <h2>Recent Quizzes</h2>
          <p>Latest 10 saved quizzes</p>
        </div>

        {reviewCenter.recentQuizzes.length === 0 ? (
          <article className="card">
            <h2>No recent quizzes</h2>
            <p>Your saved quiz history will appear here.</p>
          </article>
        ) : (
          <div className="list">
            {reviewCenter.recentQuizzes.map((quiz) => (
              <article className="list-item" key={quiz.id}>
                <div>
                  <h2>{quiz.documentTitle}</h2>
                  <p>
                    {quiz.questionCount} questions - Created{" "}
                    {formatDateTime(quiz.createdAt)}
                  </p>
                </div>
                <div className="list-item-actions">
                  <Link className="button secondary" href={quiz.href}>
                    Continue Quiz
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="list-section parsed-text-section" aria-label="Recent notes">
        <div className="section-heading">
          <h2>Recent Notes</h2>
          <p>Latest 10 saved notes</p>
        </div>

        {reviewCenter.recentNotes.length === 0 ? (
          <article className="card">
            <h2>No recent notes</h2>
            <p>Your saved study notes will appear here.</p>
          </article>
        ) : (
          <div className="list">
            {reviewCenter.recentNotes.map((note) => (
              <article className="list-item" key={note.id}>
                <div>
                  <h2>{note.documentTitle}</h2>
                  <p>
                    {getNoteTypeLabel(note.noteType)} -{" "}
                    {note.title ?? "Untitled note"}
                  </p>
                  <p>Created {formatDateTime(note.createdAt)}</p>
                </div>
                <div className="list-item-actions">
                  <Link className="button secondary" href={note.href}>
                    Open Note
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
