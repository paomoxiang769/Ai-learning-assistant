import { redirect } from "next/navigation";
import { ReviewCenterSearch } from "./review-center-search";
import { loadReviewCenter } from "@/lib/review-center";
import { createClient } from "@/lib/supabase/server";

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
    reviewCenter.recentNotes.length +
    reviewCenter.recentFlashcards.length;

  return (
    <main className="page workspace-page">
      <section className="workspace-hero" aria-label="Review center overview">
        <div>
          <p className="eyebrow">Review Center</p>
          <h1>Unified study history</h1>
          <p>Review recent chats, quizzes, notes, and flashcards in one place.</p>
        </div>
        <aside className="workspace-hero-card">
          <span className="panel-kicker">Recent signals</span>
          <strong>{reviewSignalCount}</strong>
          <p>items available across chats, quizzes, notes, and flashcards.</p>
        </aside>
      </section>

      <section className="review-drawer-shell" aria-label="Review history workspace">
        <aside className="review-signal-rail" aria-label="Review signal summary">
          <span className="panel-kicker">Review Nexus</span>
          <h2>{reviewSignalCount} recent items</h2>
          <section className="review-command-card">
            <strong>AI review lanes</strong>
            <p>Scan recent chats, practice sets, notes, and flashcards before returning to study.</p>
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
              <span className="review-signal-chip">
                Flashcards {reviewCenter.recentFlashcards.length}
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
            <div className="activity-row">
              <span>Flashcards</span>
              <strong>{reviewCenter.recentFlashcards.length}</strong>
            </div>
          </div>
        </aside>

        <ReviewCenterSearch reviewCenter={reviewCenter} />
      </section>
    </main>
  );
}
