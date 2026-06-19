"use client";

import { useEffect, useRef, useState } from "react";
import { filterQuizzesForSearch } from "@/lib/search";
import {
  normalizeSavedStudyQuizListPayload,
  normalizeStudyQuizPayload,
  type SavedStudyQuiz,
  type StudyQuizQuestion,
} from "@/lib/study-quiz-types";

type StudyQuizPanelProps = {
  documentId: string;
  canGenerate: boolean;
  initialQuizId?: string;
};

const DEFAULT_QUIZ_COUNT = 5;

function getQuestionKey(question: StudyQuizQuestion, index: number) {
  return `${index}-${question.question}`;
}

function formatQuizCreatedAt(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function normalizeGeneratedQuizPayload(value: unknown) {
  if (Array.isArray(value)) {
    return {
      quiz: normalizeStudyQuizPayload(value),
      quizId: null,
    };
  }

  if (!value || typeof value !== "object") {
    throw new Error("Quiz response must include generated quiz data.");
  }

  const candidate = value as Record<string, unknown>;

  return {
    quiz: normalizeStudyQuizPayload(candidate.quiz),
    quizId: typeof candidate.quizId === "string" ? candidate.quizId : null,
  };
}

export function StudyQuizPanel({
  documentId,
  canGenerate,
  initialQuizId,
}: StudyQuizPanelProps) {
  const quizContentRef = useRef<HTMLElement | null>(null);
  const [quiz, setQuiz] = useState<StudyQuizQuestion[]>([]);
  const [loadedQuizId, setLoadedQuizId] = useState<string | null>(null);
  const [savedQuizzes, setSavedQuizzes] = useState<SavedStudyQuiz[]>([]);
  const [handledInitialQuizId, setHandledInitialQuizId] = useState<string | null>(
    null,
  );
  const [pendingScrollQuizId, setPendingScrollQuizId] = useState<string | null>(
    null,
  );
  const [hasLoadedQuizHistory, setHasLoadedQuizHistory] = useState(false);
  const [quizSearchQuery, setQuizSearchQuery] = useState("");
  const [revealedAnswers, setRevealedAnswers] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [deletingQuizId, setDeletingQuizId] = useState<string | null>(null);
  const [quizPendingDelete, setQuizPendingDelete] =
    useState<SavedStudyQuiz | null>(null);
  const visibleSavedQuizzes = filterQuizzesForSearch(
    savedQuizzes,
    quizSearchQuery,
  );
  const visibleQuestionKeys = quiz.map((question, index) =>
    getQuestionKey(question, index),
  );
  const revealedVisibleAnswerCount = visibleQuestionKeys.filter((questionKey) =>
    revealedAnswers.includes(questionKey),
  ).length;
  const remainingVisibleAnswerCount = Math.max(
    quiz.length - revealedVisibleAnswerCount,
    0,
  );

  async function loadQuizHistory() {
    setHistoryError("");
    setHasLoadedQuizHistory(false);
    setIsLoadingHistory(true);

    try {
      const response = await fetch(
        `/api/study/quiz?documentId=${encodeURIComponent(documentId)}`,
      );
      const payload = await response.json();

      if (!response.ok) {
        const message =
          payload && typeof payload.error === "string"
            ? payload.error
            : "Unable to load quiz history right now.";

        throw new Error(message);
      }

      setSavedQuizzes(normalizeSavedStudyQuizListPayload(payload));
    } catch (requestError) {
      setHistoryError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load quiz history right now.",
      );
    } finally {
      setHasLoadedQuizHistory(true);
      setIsLoadingHistory(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function loadInitialQuizHistory() {
      setHistoryError("");
      setIsLoadingHistory(true);

      try {
        const response = await fetch(
          `/api/study/quiz?documentId=${encodeURIComponent(documentId)}`,
        );
        const payload = await response.json();

        if (!response.ok) {
          const message =
            payload && typeof payload.error === "string"
              ? payload.error
              : "Unable to load quiz history right now.";

          throw new Error(message);
        }

        if (isMounted) {
          setSavedQuizzes(normalizeSavedStudyQuizListPayload(payload));
        }
      } catch (requestError) {
        if (isMounted) {
          setHistoryError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to load quiz history right now.",
          );
        }
      } finally {
        if (isMounted) {
          setHasLoadedQuizHistory(true);
          setIsLoadingHistory(false);
        }
      }
    }

    loadInitialQuizHistory();

    return () => {
      isMounted = false;
    };
  }, [documentId]);

  useEffect(() => {
    if (
      !initialQuizId ||
      !hasLoadedQuizHistory ||
      isLoadingHistory ||
      handledInitialQuizId === initialQuizId
    ) {
      return;
    }

    if (historyError) {
      setHandledInitialQuizId(initialQuizId);
      return;
    }

    const matchingQuiz = savedQuizzes.find(
      (savedQuiz) => savedQuiz.id === initialQuizId,
    );

    if (!matchingQuiz) {
      setHistoryError("Saved quiz not found.");
      setHandledInitialQuizId(initialQuizId);

      return;
    }

    setError("");
    setQuiz(matchingQuiz.quiz);
    setLoadedQuizId(matchingQuiz.id);
    setRevealedAnswers([]);
    setHandledInitialQuizId(initialQuizId);
    setPendingScrollQuizId(initialQuizId);
  }, [
    handledInitialQuizId,
    hasLoadedQuizHistory,
    historyError,
    initialQuizId,
    isLoadingHistory,
    savedQuizzes,
  ]);

  useEffect(() => {
    if (
      !pendingScrollQuizId ||
      loadedQuizId !== pendingScrollQuizId ||
      quiz.length === 0
    ) {
      return;
    }

    let timeoutId: number | undefined;
    const animationFrameId = window.requestAnimationFrame(() => {
      timeoutId = window.setTimeout(() => {
        quizContentRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
        setPendingScrollQuizId(null);
      }, 100);
    });

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [loadedQuizId, pendingScrollQuizId, quiz.length]);

  async function handleGenerateQuiz() {
    if (!canGenerate || isSubmitting) {
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/study/quiz", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          documentId,
          count: DEFAULT_QUIZ_COUNT,
          save: true,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        const message =
          payload && typeof payload.error === "string"
            ? payload.error
            : "Unable to generate quiz right now.";

        throw new Error(message);
      }

      const generatedQuiz = normalizeGeneratedQuizPayload(payload);

      setQuiz(generatedQuiz.quiz);
      setLoadedQuizId(generatedQuiz.quizId);
      setRevealedAnswers([]);
      await loadQuizHistory();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to generate quiz right now.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function toggleAnswer(questionKey: string) {
    setRevealedAnswers((currentKeys) =>
      currentKeys.includes(questionKey)
        ? currentKeys.filter((key) => key !== questionKey)
        : [...currentKeys, questionKey],
    );
  }

  function loadSavedQuiz(savedQuiz: SavedStudyQuiz) {
    setError("");

    if (loadedQuizId === savedQuiz.id) {
      setQuiz([]);
      setLoadedQuizId(null);
      setRevealedAnswers([]);
      return;
    }

    setQuiz(savedQuiz.quiz);
    setLoadedQuizId(savedQuiz.id);
    setRevealedAnswers([]);
  }

  async function deleteSavedQuiz(savedQuiz: SavedStudyQuiz) {
    setHistoryError("");
    setDeletingQuizId(savedQuiz.id);

    try {
      const response = await fetch("/api/study/quiz", {
        method: "DELETE",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          quizId: savedQuiz.id,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        const message =
          payload && typeof payload.error === "string"
            ? payload.error
            : "Unable to delete quiz right now.";

        throw new Error(message);
      }

      setSavedQuizzes((currentSavedQuizzes) =>
        currentSavedQuizzes.filter((quizItem) => quizItem.id !== savedQuiz.id),
      );

      if (loadedQuizId === savedQuiz.id) {
        setQuiz([]);
        setLoadedQuizId(null);
        setRevealedAnswers([]);
      }
      setQuizPendingDelete(null);
    } catch (requestError) {
      setHistoryError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to delete quiz right now.",
      );
    } finally {
      setDeletingQuizId(null);
    }
  }

  return (
    <section
      className="list-section parsed-text-section document-tool-panel"
      aria-label="Generate quiz"
      id="quiz-section"
      style={{ scrollMarginTop: "5rem" }}
    >
      <div className="section-heading">
        <div>
          <span className="panel-kicker">Practice</span>
          <h2>Generate Quiz</h2>
          <p>Create 5 practice questions from this document</p>
        </div>
      </div>

      <article className="study-quiz-form document-tool-form">
        <p className="form-message">
          Generates a temporary quiz from the current document text. Questions are
          saved to quiz history for review.
        </p>

        {!canGenerate ? (
          <p className="form-message warning">
            This document is not ready for quiz generation yet. Wait until
            processing is completed.
          </p>
        ) : null}

        {error ? <p className="form-message error">{error}</p> : null}

        <div className="button-row">
          <button
            className="button"
            type="button"
            onClick={handleGenerateQuiz}
            disabled={!canGenerate || isSubmitting}
          >
            {isSubmitting ? "Generating..." : "Generate Quiz"}
          </button>
        </div>
      </article>

      <div className="quiz-history" aria-label="Quiz history">
        <div className="section-heading">
          <h3>Quiz History</h3>
          <p>
            {isLoadingHistory
              ? "Loading..."
              : `${visibleSavedQuizzes.length}/${savedQuizzes.length} shown`}
          </p>
        </div>

        <label className="form-field search-field" htmlFor="quiz-search">
          Search quizzes
          <input
            id="quiz-search"
            type="search"
            value={quizSearchQuery}
            onChange={(event) => setQuizSearchQuery(event.target.value)}
            placeholder="Search questions and explanations"
          />
        </label>

        {historyError ? <p className="form-message error">{historyError}</p> : null}

        {visibleSavedQuizzes.length > 0 ? (
          <div className="list">
            {visibleSavedQuizzes.map((savedQuiz) => (
              <article className="quiz-history-item tactile-history-item" key={savedQuiz.id}>
                <div>
                  <h4>{savedQuiz.title ?? "Saved quiz"}</h4>
                  <p>
                    {formatQuizCreatedAt(savedQuiz.createdAt)} -{" "}
                    {savedQuiz.questionCount} questions
                  </p>
                </div>

                <div className="quiz-history-actions">
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() => loadSavedQuiz(savedQuiz)}
                  >
                    {loadedQuizId === savedQuiz.id ? "Hide Quiz" : "Load Quiz"}
                  </button>
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() => setQuizPendingDelete(savedQuiz)}
                    disabled={deletingQuizId === savedQuiz.id}
                  >
                    {deletingQuizId === savedQuiz.id ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : !isLoadingHistory && !historyError && savedQuizzes.length === 0 ? (
          <article className="card chat-empty-state">
            <p>No saved quizzes yet.</p>
          </article>
        ) : !isLoadingHistory && !historyError ? (
          <article className="card chat-empty-state">
            <p>No matching quizzes.</p>
          </article>
        ) : null}
      </div>

      {quiz.length > 0 ? (
        <section
          ref={quizContentRef}
          className="tactile-quiz-arena"
          aria-label="Generated quiz questions"
          style={{ scrollMarginTop: "5rem" }}
        >
          <aside className="tactile-quiz-rail" aria-label="Quiz review status">
            <span className="panel-kicker">Tactile arena</span>
            <h3>{quiz.length} question cards</h3>
            <p>
              Reveal each answer like turning over a study card, then return to
              quiz history when you are ready to review it again.
            </p>
            <div className="tactile-quiz-meter">
              <span>Answers revealed</span>
              <strong>
                {revealedVisibleAnswerCount}/{quiz.length}
              </strong>
            </div>
          </aside>

          <div className="tactile-card-stack">
            {quiz.map((question, index) => {
              const questionKey = getQuestionKey(question, index);
              const isAnswerVisible = revealedAnswers.includes(questionKey);

              return (
                <article
                  className={`card quiz-question-card tactile-question-card tactile-flip-card${
                    isAnswerVisible ? " is-revealed" : ""
                  }`}
                  key={questionKey}
                >
                  <div className="tactile-card-rotor">
                    <div
                      aria-hidden={isAnswerVisible}
                      className="tactile-card-face tactile-card-front"
                    >
                      <div className="quiz-question-meta">
                        <h3>Question {index + 1}</h3>
                        <span className="quiz-question-type">{question.type}</span>
                      </div>

                      <p className="chat-message-text">{question.question}</p>

                      {question.options?.length ? (
                        <ol className="quiz-options">
                          {question.options.map((option) => (
                            <li key={option}>{option}</li>
                          ))}
                        </ol>
                      ) : null}

                      <div className="tactile-card-footer">
                        <span>Front question</span>
                        <button
                          aria-pressed={isAnswerVisible}
                          className="button secondary"
                          type="button"
                          onClick={() => toggleAnswer(questionKey)}
                        >
                          Show answer
                        </button>
                      </div>
                    </div>

                    <div
                      aria-hidden={!isAnswerVisible}
                      className="tactile-card-face tactile-card-back"
                    >
                      <div className="quiz-question-meta">
                        <h3>Answer {index + 1}</h3>
                        <span className="quiz-question-type">review</span>
                      </div>

                      <div className="quiz-answer-panel">
                        <p>
                          <strong>Answer:</strong> {question.answer}
                        </p>
                        <p>
                          <strong>Explanation:</strong> {question.explanation}
                        </p>
                      </div>

                      <div className="tactile-card-footer">
                        <span>Back answer</span>
                        <button
                          aria-pressed={isAnswerVisible}
                          className="button secondary"
                          type="button"
                          onClick={() => toggleAnswer(questionKey)}
                        >
                          Hide answer
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <aside className="tactile-quiz-feedback" aria-label="AI quiz feedback">
            <span className="panel-kicker">AI feedback</span>
            <h3>Review pacing</h3>
            <p>
              Reveal answers one card at a time, then return to saved history
              for another pass when the set is complete.
            </p>
            <div className="activity-list">
              <div className="activity-row">
                <span>Revealed answers</span>
                <strong>{revealedVisibleAnswerCount}</strong>
              </div>
              <div className="activity-row">
                <span>Remaining cards</span>
                <strong>{remainingVisibleAnswerCount}</strong>
              </div>
              <div className="activity-row">
                <span>Saved set</span>
                <strong>{loadedQuizId ? "Loaded" : "Fresh"}</strong>
              </div>
            </div>
          </aside>
        </section>
      ) : null}

      {quizPendingDelete ? (
        <div className="ui-modal-backdrop" role="presentation">
          <section
            aria-labelledby="delete-quiz-title"
            aria-modal="true"
            className="ui-modal-card"
            role="dialog"
          >
            <div className="ui-modal-header">
              <div>
                <span className="panel-kicker">Confirm delete</span>
                <h3 id="delete-quiz-title">Delete saved quiz?</h3>
              </div>
              <button
                aria-label="Close delete quiz dialog"
                className="ui-modal-close"
                type="button"
                onClick={() => setQuizPendingDelete(null)}
              >
                X
              </button>
            </div>
            <p>
              This removes "{quizPendingDelete.title ?? "Saved quiz"}" from quiz
              history. The source document and generated study data stay intact.
            </p>
            <div className="button-row compact-button-row">
              <button
                className="button secondary"
                type="button"
                onClick={() => setQuizPendingDelete(null)}
                disabled={deletingQuizId === quizPendingDelete.id}
              >
                Cancel
              </button>
              <button
                className="button"
                type="button"
                onClick={() => deleteSavedQuiz(quizPendingDelete)}
                disabled={deletingQuizId === quizPendingDelete.id}
              >
                {deletingQuizId === quizPendingDelete.id ? "Deleting..." : "Delete"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
