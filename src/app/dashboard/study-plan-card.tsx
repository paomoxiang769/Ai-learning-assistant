"use client";

import { useState } from "react";
import { BorderGlow } from "@/components/border-glow";

type StudyPlanItem = {
  task: string;
  topic?: string;
  reason: string;
  recommendedAction: string;
};

type StudyPlanResponse = {
  plan: StudyPlanItem[];
};

function getErrorMessage(value: unknown) {
  return value instanceof Error ? value.message : "Unable to generate study plan.";
}

export function StudyPlanCard() {
  const [plan, setPlan] = useState<StudyPlanItem[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleGeneratePlan() {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/study/plan", {
        method: "POST",
      });
      const payload = (await response.json()) as Partial<
        StudyPlanResponse & { error: string }
      >;

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to generate study plan.");
      }

      if (!Array.isArray(payload.plan)) {
        throw new Error("Study plan response was incomplete.");
      }

      setPlan(payload.plan);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <BorderGlow className="card study-plan-card">
      <div className="study-plan-heading">
        <div>
          <p className="eyebrow">Study Intelligence v2.6</p>
          <h2>AI Study Plan</h2>
          <p>
            Turn weak signals, recent review activity, notes, quizzes,
            flashcards, and chats into a short action plan.
          </p>
        </div>
        <span className="ai-review-badge">Session</span>
      </div>

      <div className="button-row compact-button-row">
        <button
          className="button"
          disabled={isLoading}
          onClick={handleGeneratePlan}
          type="button"
        >
          {isLoading
            ? "Generating..."
            : plan
              ? "Regenerate Plan"
              : "Generate Study Plan"}
        </button>
      </div>

      {errorMessage ? <p className="form-message error">{errorMessage}</p> : null}

      {plan ? (
        plan.length > 0 ? (
          <div className="study-plan-result">
            <span className="panel-kicker">Today's Plan</span>
            <div className="study-plan-list">
              {plan.slice(0, 5).map((item, index) => (
                <section
                  className="study-plan-item"
                  key={`${item.task}-${item.topic ?? index}`}
                >
                  <div className="study-plan-task">
                    <span className="study-plan-index">{index + 1}</span>
                    <div>
                      <span className="panel-kicker">Task</span>
                      <h3>{item.task}</h3>
                      {item.topic ? <p>{item.topic}</p> : null}
                    </div>
                  </div>
                  <div className="study-plan-detail-grid">
                    <section className="study-plan-reason">
                      <span className="panel-kicker">Reason</span>
                      <p>{item.reason}</p>
                    </section>
                    <section className="study-plan-action">
                      <span className="panel-kicker">Recommended Action</span>
                      <p>{item.recommendedAction}</p>
                    </section>
                  </div>
                </section>
              ))}
            </div>
          </div>
        ) : (
          <div className="ai-review-empty">
            <p>Not enough study activity yet.</p>
          </div>
        )
      ) : (
        <div className="ai-review-empty">
          <span className="panel-kicker">Plan sources</span>
          <p>
            Generate a session plan after study chats, notes, quizzes, or
            flashcards create enough activity signals.
          </p>
        </div>
      )}
    </BorderGlow>
  );
}
