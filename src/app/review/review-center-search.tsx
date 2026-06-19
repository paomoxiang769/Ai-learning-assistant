"use client";

import Link from "next/link";
import { useState } from "react";
import { filterReviewItemsForSearch } from "@/lib/search";
import type { ReviewCenterOverview } from "@/lib/review-center";

type ReviewCenterSearchProps = {
  reviewCenter: ReviewCenterOverview;
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getNoteTypeLabel(noteType: "ai_summary" | "manual") {
  return noteType === "ai_summary" ? "AI notes" : "Manual";
}

type ReviewSectionId = "chats" | "quizzes" | "notes" | "flashcards";

export function ReviewCenterSearch({ reviewCenter }: ReviewCenterSearchProps) {
  const [reviewSearchQuery, setReviewSearchQuery] = useState("");
  const [visibleReviewSections, setVisibleReviewSections] = useState<
    Record<ReviewSectionId, boolean>
  >({
    chats: true,
    quizzes: true,
    notes: true,
    flashcards: true,
  });
  const visibleChats = filterReviewItemsForSearch(
    reviewCenter.recentChats,
    reviewSearchQuery,
  );
  const visibleQuizzes = filterReviewItemsForSearch(
    reviewCenter.recentQuizzes,
    reviewSearchQuery,
  );
  const visibleNotes = filterReviewItemsForSearch(
    reviewCenter.recentNotes,
    reviewSearchQuery,
  );
  const visibleFlashcards = filterReviewItemsForSearch(
    reviewCenter.recentFlashcards,
    reviewSearchQuery,
  );
  const visibleCount =
    visibleChats.length +
    visibleQuizzes.length +
    visibleNotes.length +
    visibleFlashcards.length;
  const totalCount =
    reviewCenter.recentChats.length +
    reviewCenter.recentQuizzes.length +
    reviewCenter.recentNotes.length +
    reviewCenter.recentFlashcards.length;

  function toggleReviewSection(sectionId: ReviewSectionId) {
    setVisibleReviewSections((currentSections) => ({
      ...currentSections,
      [sectionId]: !currentSections[sectionId],
    }));
  }

  return (
    <div className="review-main-panel">
      <section className="list-section review-search-panel" aria-label="Review search">
        <div className="section-heading">
          <div>
            <span className="panel-kicker">Search</span>
            <h2>Review Search</h2>
            <p>{visibleCount}/{totalCount} recent items shown</p>
          </div>
        </div>
        <label className="form-field search-field" htmlFor="review-search">
          Search review center
          <input
            id="review-search"
            type="search"
            value={reviewSearchQuery}
            onChange={(event) => setReviewSearchQuery(event.target.value)}
            placeholder="Search recent chats, notes, quizzes, flashcards"
          />
        </label>
      </section>

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
            <button
              aria-pressed={visibleReviewSections.chats}
              className="review-lane-toggle review-lane-header-action"
              onClick={() => toggleReviewSection("chats")}
              type="button"
            >
              {visibleReviewSections.chats ? "Hide chats" : "Show chats"}
            </button>
          </div>

          {visibleReviewSections.chats ? (
            <div className="review-lane-body">
              {visibleChats.length === 0 ? (
                <article className="card empty-card">
                  <h2>No recent chats</h2>
                  <p>Your assistant chat history or matching chat results will appear here.</p>
                </article>
              ) : (
                <div className="list">
                  {visibleChats.map((chat) => (
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
            </div>
          ) : null}
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
            <button
              aria-pressed={visibleReviewSections.quizzes}
              className="review-lane-toggle review-lane-header-action"
              onClick={() => toggleReviewSection("quizzes")}
              type="button"
            >
              {visibleReviewSections.quizzes ? "Hide quizzes" : "Show quizzes"}
            </button>
          </div>

          {visibleReviewSections.quizzes ? (
            <div className="review-lane-body">
              {visibleQuizzes.length === 0 ? (
                <article className="card empty-card">
                  <h2>No recent quizzes</h2>
                  <p>Your saved quiz history or matching quiz results will appear here.</p>
                </article>
              ) : (
                <div className="list">
                  {visibleQuizzes.map((quiz) => (
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
            </div>
          ) : null}
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
            <button
              aria-pressed={visibleReviewSections.notes}
              className="review-lane-toggle review-lane-header-action"
              onClick={() => toggleReviewSection("notes")}
              type="button"
            >
              {visibleReviewSections.notes ? "Hide notes" : "Show notes"}
            </button>
          </div>

          {visibleReviewSections.notes ? (
            <div className="review-lane-body">
              {visibleNotes.length === 0 ? (
                <article className="card empty-card">
                  <h2>No recent notes</h2>
                  <p>Your saved study notes or matching note results will appear here.</p>
                </article>
              ) : (
                <div className="list">
                  {visibleNotes.map((note) => (
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
            </div>
          ) : null}
        </section>

        <section
          className="list-section review-workspace-column review-history-drawer"
          aria-label="Recent flashcards"
        >
          <div className="section-heading">
            <div>
              <h2>Recent Flashcards</h2>
              <p>Latest 10 saved flashcards</p>
            </div>
            <button
              aria-pressed={visibleReviewSections.flashcards}
              className="review-lane-toggle review-lane-header-action"
              onClick={() => toggleReviewSection("flashcards")}
              type="button"
            >
              {visibleReviewSections.flashcards
                ? "Hide flashcards"
                : "Show flashcards"}
            </button>
          </div>

          {visibleReviewSections.flashcards ? (
            <div className="review-lane-body">
              {visibleFlashcards.length === 0 ? (
                <article className="card empty-card">
                  <h2>No recent flashcards</h2>
                  <p>Your saved flashcards or matching flashcard results will appear here.</p>
                </article>
              ) : (
                <div className="list">
                  {visibleFlashcards.map((flashcard) => (
                    <article className="list-item workspace-list-item" key={flashcard.id}>
                      <span className="review-lane-marker">Flashcard</span>
                      <div>
                        <span className="panel-kicker">Memory card</span>
                        <h2>{flashcard.documentTitle}</h2>
                        <p>{flashcard.question}</p>
                        <p>Created {formatDateTime(flashcard.createdAt)}</p>
                      </div>
                      <div className="list-item-actions">
                        <Link className="button secondary" href={flashcard.href}>
                          Review Flashcards
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
