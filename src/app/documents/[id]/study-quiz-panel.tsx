"use client";

import { useState } from "react";
import {
  normalizeStudyQuizPayload,
  type StudyQuizQuestion,
} from "@/lib/study-quiz-types";

type StudyQuizPanelProps = {
  documentId: string;
  canGenerate: boolean;
};

const DEFAULT_QUIZ_COUNT = 5;

function getQuestionKey(question: StudyQuizQuestion, index: number) {
  return `${index}-${question.question}`;
}

export function StudyQuizPanel({
  documentId,
  canGenerate,
}: StudyQuizPanelProps) {
  const [quiz, setQuiz] = useState<StudyQuizQuestion[]>([]);
  const [revealedAnswers, setRevealedAnswers] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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

      setQuiz(normalizeStudyQuizPayload(payload));
      setRevealedAnswers([]);
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

  return (
    <section className="list-section parsed-text-section" aria-label="Generate quiz">
      <div className="section-heading">
        <h2>Generate Quiz</h2>
        <p>Create 5 practice questions from this document</p>
      </div>

      <article className="study-quiz-form">
        <p className="form-message">
          Generates a temporary quiz from the current document text. Questions are
          not saved.
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

      {quiz.length > 0 ? (
        <div className="list" aria-label="Generated quiz questions">
          {quiz.map((question, index) => {
            const questionKey = getQuestionKey(question, index);
            const isAnswerVisible = revealedAnswers.includes(questionKey);

            return (
              <article className="card quiz-question-card" key={questionKey}>
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

                <div className="button-row">
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() => toggleAnswer(questionKey)}
                  >
                    {isAnswerVisible ? "Hide answer" : "Show answer"}
                  </button>
                </div>

                {isAnswerVisible ? (
                  <div className="quiz-answer-panel">
                    <p>
                      <strong>Answer:</strong> {question.answer}
                    </p>
                    <p>
                      <strong>Explanation:</strong> {question.explanation}
                    </p>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
