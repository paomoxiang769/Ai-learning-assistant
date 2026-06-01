"use client";

import { useState } from "react";

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

function getErrorMessage(value: unknown) {
  return value instanceof Error ? value.message : "Unable to generate review advice.";
}

export function AiReviewCard() {
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

  return (
    <article className="card ai-review-card">
      <div>
        <h2>AI Review</h2>
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
          <pre className="review-advice">{review.advice}</pre>
          <p>
            Signals: {review.signals.recentChatsCount} chats,{" "}
            {review.signals.recentQuizzesCount} quizzes,{" "}
            {review.signals.recentNotesCount} notes
            {review.signals.mostStudiedDocumentTitle
              ? `, most studied: ${review.signals.mostStudiedDocumentTitle}`
              : ""}
          </p>
        </div>
      ) : null}
    </article>
  );
}
