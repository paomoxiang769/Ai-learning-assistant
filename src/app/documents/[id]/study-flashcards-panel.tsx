"use client";

import { useEffect, useMemo, useState } from "react";
import type { SavedStudyFlashcard } from "@/lib/study-flashcards";

type StudyFlashcardsPanelProps = {
  documentId: string;
  canGenerate: boolean;
};

function formatFlashcardCreatedAt(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function normalizeFlashcard(value: unknown): SavedStudyFlashcard {
  if (!value || typeof value !== "object") {
    throw new Error("Flashcard response must include flashcard data.");
  }

  const candidate = value as Record<string, unknown>;

  return {
    id: typeof candidate.id === "string" ? candidate.id : "",
    documentId: typeof candidate.documentId === "string" ? candidate.documentId : "",
    question: typeof candidate.question === "string" ? candidate.question : "",
    answer: typeof candidate.answer === "string" ? candidate.answer : "",
    createdAt: typeof candidate.createdAt === "string" ? candidate.createdAt : "",
  };
}

function normalizeFlashcardList(value: unknown): SavedStudyFlashcard[] {
  if (!Array.isArray(value)) {
    throw new Error("Flashcards response must be a list.");
  }

  return value
    .map(normalizeFlashcard)
    .filter((flashcard) => flashcard.id && flashcard.question && flashcard.answer);
}

export function StudyFlashcardsPanel({
  documentId,
  canGenerate,
}: StudyFlashcardsPanelProps) {
  const [flashcards, setFlashcards] = useState<SavedStudyFlashcard[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [error, setError] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [deletingFlashcardId, setDeletingFlashcardId] = useState<string | null>(null);
  const activeFlashcard = flashcards[activeIndex] ?? null;

  const statusText = useMemo(() => {
    if (isLoadingHistory) {
      return "Loading...";
    }

    return `${flashcards.length} saved`;
  }, [flashcards.length, isLoadingHistory]);

  async function loadFlashcardsHistory() {
    setHistoryError("");
    setIsLoadingHistory(true);

    try {
      const response = await fetch(
        `/api/study/flashcards?documentId=${encodeURIComponent(documentId)}`,
      );
      const payload = await response.json();

      if (!response.ok) {
        const message =
          payload && typeof payload.error === "string"
            ? payload.error
            : "Unable to load flashcards right now.";

        throw new Error(message);
      }

      const normalizedFlashcards = normalizeFlashcardList(payload);
      setFlashcards(normalizedFlashcards);
      setActiveIndex((currentIndex) =>
        normalizedFlashcards.length === 0
          ? 0
          : Math.min(currentIndex, normalizedFlashcards.length - 1),
      );
    } catch (requestError) {
      setHistoryError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load flashcards right now.",
      );
    } finally {
      setIsLoadingHistory(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function loadInitialFlashcards() {
      setHistoryError("");
      setIsLoadingHistory(true);

      try {
        const response = await fetch(
          `/api/study/flashcards?documentId=${encodeURIComponent(documentId)}`,
        );
        const payload = await response.json();

        if (!response.ok) {
          const message =
            payload && typeof payload.error === "string"
              ? payload.error
              : "Unable to load flashcards right now.";

          throw new Error(message);
        }

        if (isMounted) {
          setFlashcards(normalizeFlashcardList(payload));
        }
      } catch (requestError) {
        if (isMounted) {
          setHistoryError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to load flashcards right now.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingHistory(false);
        }
      }
    }

    loadInitialFlashcards();

    return () => {
      isMounted = false;
    };
  }, [documentId]);

  async function handleGenerateFlashcards() {
    if (!canGenerate || isGenerating) {
      return;
    }

    setError("");
    setIsGenerating(true);

    try {
      const response = await fetch("/api/study/flashcards/generate", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          documentId,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        const message =
          payload && typeof payload.error === "string"
            ? payload.error
            : "Unable to generate flashcards right now.";

        throw new Error(message);
      }

      const generatedFlashcards = normalizeFlashcardList(payload);
      setFlashcards(generatedFlashcards);
      setActiveIndex(0);
      setIsFlipped(false);
      await loadFlashcardsHistory();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to generate flashcards right now.",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  function showPreviousFlashcard() {
    setActiveIndex((currentIndex) => Math.max(currentIndex - 1, 0));
    setIsFlipped(false);
  }

  function showNextFlashcard() {
    setActiveIndex((currentIndex) =>
      Math.min(currentIndex + 1, Math.max(flashcards.length - 1, 0)),
    );
    setIsFlipped(false);
  }

  async function deleteFlashcard(flashcard: SavedStudyFlashcard) {
    setHistoryError("");
    setDeletingFlashcardId(flashcard.id);

    try {
      const response = await fetch("/api/study/flashcards", {
        method: "DELETE",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          flashcardId: flashcard.id,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        const message =
          payload && typeof payload.error === "string"
            ? payload.error
            : "Unable to delete flashcard right now.";

        throw new Error(message);
      }

      setFlashcards((currentFlashcards) => {
        const nextFlashcards = currentFlashcards.filter(
          (item) => item.id !== flashcard.id,
        );
        setActiveIndex((currentIndex) =>
          nextFlashcards.length === 0
            ? 0
            : Math.min(currentIndex, nextFlashcards.length - 1),
        );
        return nextFlashcards;
      });
      setIsFlipped(false);
    } catch (requestError) {
      setHistoryError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to delete flashcard right now.",
      );
    } finally {
      setDeletingFlashcardId(null);
    }
  }

  return (
    <section
      className="list-section parsed-text-section document-tool-panel"
      aria-label="Flashcards"
      id="flashcards-section"
      style={{ scrollMarginTop: "5rem" }}
    >
      <div className="section-heading">
        <div>
          <span className="panel-kicker">Memory</span>
          <h2>Flashcards</h2>
          <p>{statusText}</p>
        </div>
      </div>

      <article className="study-quiz-form document-tool-form">
        <p className="form-message">
          Generate quick review cards from this document summary, saved notes,
          and saved quizzes.
        </p>

        {!canGenerate ? (
          <p className="form-message warning">
            Flashcards need completed document processing first.
          </p>
        ) : null}

        {error ? <p className="form-message error">{error}</p> : null}

        <div className="button-row">
          <button
            className="button"
            type="button"
            onClick={handleGenerateFlashcards}
            disabled={!canGenerate || isGenerating}
          >
            {isGenerating ? "Generating..." : "Generate Flashcards"}
          </button>
        </div>
      </article>

      <section className="flashcards-study-deck" aria-label="Flashcard study deck">
        {activeFlashcard ? (
          <article className={`card flashcard-review-card${isFlipped ? " is-flipped" : ""}`}>
            <span className="panel-kicker">{isFlipped ? "Back" : "Front"}</span>
            <h3>{isFlipped ? "Answer" : "Question"}</h3>
            <p className="raw-text-preview">
              {isFlipped ? activeFlashcard.answer : activeFlashcard.question}
            </p>
            <div className="button-row compact-button-row">
              <button
                className="button secondary"
                type="button"
                onClick={() => setIsFlipped((currentValue) => !currentValue)}
              >
                Flip Card
              </button>
              <button
                className="button secondary"
                type="button"
                onClick={showPreviousFlashcard}
                disabled={activeIndex === 0}
              >
                Previous
              </button>
              <button
                className="button secondary"
                type="button"
                onClick={showNextFlashcard}
                disabled={activeIndex >= flashcards.length - 1}
              >
                Next
              </button>
              <button
                className="button secondary"
                type="button"
                onClick={() => deleteFlashcard(activeFlashcard)}
                disabled={deletingFlashcardId === activeFlashcard.id}
              >
                {deletingFlashcardId === activeFlashcard.id ? "Deleting..." : "Delete"}
              </button>
            </div>
            <p className="form-message">
              Card {activeIndex + 1} of {flashcards.length}
            </p>
          </article>
        ) : (
          <article className="card chat-empty-state">
            <p>No flashcards yet.</p>
          </article>
        )}
      </section>

      <section className="quiz-history" aria-label="Flashcards history">
        <div className="section-heading">
          <h3>Flashcards History</h3>
          <p>{statusText}</p>
        </div>

        {historyError ? <p className="form-message error">{historyError}</p> : null}

        {flashcards.length > 0 ? (
          <div className="list">
            {flashcards.map((flashcard, index) => (
              <article
                className="quiz-history-item tactile-history-item"
                key={flashcard.id}
              >
                <div>
                  <h4>{flashcard.question}</h4>
                  <p>Created {formatFlashcardCreatedAt(flashcard.createdAt)}</p>
                </div>
                <div className="quiz-history-actions">
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() => {
                      setActiveIndex(index);
                      setIsFlipped(false);
                    }}
                  >
                    Study
                  </button>
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() => deleteFlashcard(flashcard)}
                    disabled={deletingFlashcardId === flashcard.id}
                  >
                    {deletingFlashcardId === flashcard.id ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : !isLoadingHistory && !historyError ? (
          <article className="card chat-empty-state">
            <p>No saved flashcards yet.</p>
          </article>
        ) : null}
      </section>
    </section>
  );
}
