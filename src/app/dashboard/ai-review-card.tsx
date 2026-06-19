"use client";

import { useState } from "react";
import { BorderGlow } from "@/components/border-glow";

type StudyReviewSignals = {
  recentChatsCount: number;
  recentQuizzesCount: number;
  recentNotesCount: number;
  mostStudiedDocumentTitle?: string;
};

type StudyReviewResponse = {
  advice: string;
  signals: StudyReviewSignals;
};

type AiReviewCardProps = {
  hasStudyActivity?: boolean;
  mostStudiedDocumentTitle?: string;
};

function getErrorMessage(value: unknown) {
  return value instanceof Error ? value.message : "Unable to generate review advice.";
}

export function AiReviewCard({
  hasStudyActivity = false,
  mostStudiedDocumentTitle,
}: AiReviewCardProps) {
  const [review, setReview] = useState<StudyReviewResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleGenerateReview() {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/study/review", {
        method: "POST",
      });
      const payload = (await response.json()) as Partial<
        StudyReviewResponse & { error: string }
      >;

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to generate review advice.");
      }

      if (!payload.advice || !payload.signals) {
        throw new Error("Review response was incomplete.");
      }

      setReview({
        advice: payload.advice,
        signals: payload.signals,
      });
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  const reviewTarget =
    review?.signals.mostStudiedDocumentTitle ??
    mostStudiedDocumentTitle ??
    "your latest study activity";
  const guidanceCopy = hasStudyActivity
    ? "Use recent chats, quizzes, and notes to decide what deserves attention next."
    : "Create a review once you have chats, quizzes, or notes. The assistant will turn activity into a next step.";

  return (
    <BorderGlow className="card ai-review-card">
      <div className="ai-review-heading">
        <div>
          <p className="eyebrow">AI Review</p>
          <h2>What should you review next?</h2>
          <p>{guidanceCopy}</p>
        </div>
        <span className="ai-review-badge">Core</span>
      </div>

      <div className="button-row compact-button-row">
        <button
          className="button"
          disabled={isLoading}
          onClick={handleGenerateReview}
          type="button"
        >
          {isLoading ? "Generating..." : "Generate review advice"}
        </button>
      </div>

      {errorMessage ? <p className="form-message error">{errorMessage}</p> : null}

      {review ? (
        <div className="ai-review-result">
          <div className="review-insight-grid">
            <section>
              <span className="panel-kicker">What to review next</span>
              <h3>{reviewTarget}</h3>
            </section>
            <section>
              <span className="panel-kicker">Why</span>
              <p>
                Based on {review.signals.recentChatsCount} chats,{" "}
                {review.signals.recentQuizzesCount} quizzes, and{" "}
                {review.signals.recentNotesCount} notes.
              </p>
            </section>
          </div>
          <section className="review-action-panel">
            <span className="panel-kicker">Suggested action</span>
            <pre className="review-advice">{review.advice}</pre>
          </section>
        </div>
      ) : (
        <div className="ai-review-empty">
          <span className="panel-kicker">Suggested flow</span>
          <p>
            Generate a review, scan the recommended focus, then continue from
            the document or quiz that needs the most attention.
          </p>
        </div>
      )}
    </BorderGlow>
  );
}
