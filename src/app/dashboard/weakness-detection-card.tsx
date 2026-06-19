"use client";

import { useState } from "react";
import { BorderGlow } from "@/components/border-glow";

type WeaknessConfidence = "High" | "Medium" | "Low";

type WeakTopic = {
  topic: string;
  confidence: WeaknessConfidence;
  reason: string;
  suggestedAction: string;
};

type WeaknessDetectionResponse = {
  weakTopics: WeakTopic[];
};

function getErrorMessage(value: unknown) {
  return value instanceof Error
    ? value.message
    : "Unable to detect weak study topics.";
}

export function WeaknessDetectionCard() {
  const [weakTopics, setWeakTopics] = useState<WeakTopic[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleDetectWeaknesses() {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/study/weakness", {
        method: "POST",
      });
      const payload = (await response.json()) as Partial<
        WeaknessDetectionResponse & { error: string }
      >;

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to detect weak study topics.");
      }

      if (!Array.isArray(payload.weakTopics)) {
        throw new Error("Weakness detection response was incomplete.");
      }

      setWeakTopics(payload.weakTopics);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <BorderGlow className="card weakness-detection-card">
      <div className="weakness-detection-heading">
        <div>
          <p className="eyebrow">Study Intelligence v2.4</p>
          <h2>Weakness Detection</h2>
          <p>
            Find the topics most likely to need another pass from recent chats,
            notes, and quizzes.
          </p>
        </div>
        <span className="ai-review-badge">Beta</span>
      </div>

      <div className="button-row compact-button-row">
        <button
          className="button"
          disabled={isLoading}
          onClick={handleDetectWeaknesses}
          type="button"
        >
          {isLoading ? "Analyzing..." : "Detect weak topics"}
        </button>
      </div>

      {errorMessage ? <p className="form-message error">{errorMessage}</p> : null}

      {weakTopics ? (
        weakTopics.length > 0 ? (
          <div className="weak-topic-list">
            {weakTopics.slice(0, 3).map((topic) => (
              <section className="weak-topic-item" key={topic.topic}>
                <div>
                  <span className="panel-kicker">Topic</span>
                  <h3>{topic.topic}</h3>
                </div>
                <div className="weak-topic-meta">
                  <span>
                    <strong>Confidence</strong>
                    {topic.confidence}
                  </span>
                  <span>
                    <strong>Reason</strong>
                    {topic.reason}
                  </span>
                  <span>
                    <strong>Suggested Action</strong>
                    {topic.suggestedAction}
                  </span>
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="ai-review-empty">
            <p>Not enough study activity yet.</p>
          </div>
        )
      ) : (
        <div className="ai-review-empty">
          <span className="panel-kicker">Signal sources</span>
          <p>
            Run detection after a few recent questions, notes, or saved quizzes
            so the assistant can compare repeated signals.
          </p>
        </div>
      )}
    </BorderGlow>
  );
}
