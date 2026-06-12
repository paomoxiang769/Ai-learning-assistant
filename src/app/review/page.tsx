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
  const reviewSignalCount =
    reviewCenter.recentChats.length +
    reviewCenter.recentQuizzes.length +
    reviewCenter.recentNotes.length;

  return (
    <main className="page workspace-page">
      <section className="workspace-hero" aria-label="Review center overview">
        <div>
          <p className="eyebrow">Review Center</p>
          <h1>Unified study history</h1>
          <p>Review recent chats, quizzes, and notes in one place.</p>
        </div>
        <aside className="workspace-hero-card">
          <span className="panel-kicker">Recent signals</span>
          <strong>{reviewSignalCount}</strong>
          <p>items available across chats, quizzes, and notes.</p>
        </aside>
      </section>

      <section className="review-drawer-shell" aria-label="Review history workspace">
        <aside className="review-signal-rail" aria-label="Review signal summary">
          <span className="panel-kicker">Review Nexus</span>
          <h2>{reviewSignalCount} recent items</h2>
          <section className="review-command-card">
            <strong>AI review lanes</strong>
            <p>Scan recent chats, practice sets, and notes before returning to study.</p>
            <div className="review-signal-chips" aria-label="Review signal lanes">
              <span className="review-signal-chip">
                Chats {reviewCenter.recentChats.length}
              </span>
              <span className="review-signal-chip">
                Quizzes {reviewCenter.recentQuizzes.length}
              </span>
              <span className="review-signal-chip">
                Notes {reviewCenter.recentNotes.length}
              </span>
            </div>
          </section>
          <div className="activity-list">
            <div className="activity-row">
              <span>Chats</span>
              <strong>{reviewCenter.recentChats.length}</strong>
            </div>
            <div className="activity-row">
              <span>Quizzes</span>
              <strong>{reviewCenter.recentQuizzes.length}</strong>
            </div>
            <div className="activity-row">
              <span>Notes</span>
              <strong>{reviewCenter.recentNotes.length}</strong>
            </div>
          </div>
        </aside>

        <div className="review-section-grid review-workspace-grid">
        <section
          className="list-section review-workspace-column review-history-drawer"
          aria-label="Recent chats"
        >
          <div className="section-heading">
            <div>
              <h2>Recent Chats</h2>
              <p>Latest 10 assistant replies</p>
            </div>
          </div>

          {reviewCenter.recentChats.length === 0 ? (
            <article className="card empty-card">
              <h2>No recent chats</h2>
              <p>Your assistant chat history will appear here.</p>
            </article>
          ) : (
            <div className="list">
              {reviewCenter.recentChats.map((chat) => (
                <article className="list-item workspace-list-item" key={chat.id}>
                  <span className="review-lane-marker">Chat</span>
                  <div>
                    <span className="panel-kicker">Asked question</span>
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

        <section
          className="list-section review-workspace-column review-history-drawer"
          aria-label="Recent quizzes"
        >
          <div className="section-heading">
            <div>
              <h2>Recent Quizzes</h2>
              <p>Latest 10 saved quizzes</p>
            </div>
          </div>

          {reviewCenter.recentQuizzes.length === 0 ? (
            <article className="card empty-card">
              <h2>No recent quizzes</h2>
              <p>Your saved quiz history will appear here.</p>
            </article>
          ) : (
            <div className="list">
              {reviewCenter.recentQuizzes.map((quiz) => (
                <article className="list-item workspace-list-item" key={quiz.id}>
                  <span className="review-lane-marker">Quiz</span>
                  <div>
                    <span className="panel-kicker">Practice set</span>
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

        <section
          className="list-section review-workspace-column review-history-drawer"
          aria-label="Recent notes"
        >
          <div className="section-heading">
            <div>
              <h2>Recent Notes</h2>
              <p>Latest 10 saved notes</p>
            </div>
          </div>

          {reviewCenter.recentNotes.length === 0 ? (
            <article className="card empty-card">
              <h2>No recent notes</h2>
              <p>Your saved study notes will appear here.</p>
            </article>
          ) : (
            <div className="list">
              {reviewCenter.recentNotes.map((note) => (
                <article className="list-item workspace-list-item" key={note.id}>
                  <span className="review-lane-marker">Note</span>
                  <div>
                    <span className="panel-kicker">{getNoteTypeLabel(note.noteType)}</span>
                    <h2>{note.documentTitle}</h2>
                    <p>{note.title ?? "Untitled note"}</p>
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
        </div>
      </section>
    </main>
  );
}
