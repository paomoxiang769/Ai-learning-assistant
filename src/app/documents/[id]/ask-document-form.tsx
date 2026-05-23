"use client";

import { useState, type FormEvent } from "react";
import {
  analyzeSourcePreview,
  formatSourceSimilarity,
  normalizeRagAnswerPayload,
  type RagAnswerSource,
} from "@/lib/rag-answer-client";

type AskDocumentFormProps = {
  documentId: string;
  canAsk: boolean;
};

export function AskDocumentForm({
  documentId,
  canAsk,
}: AskDocumentFormProps) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<RagAnswerSource[]>([]);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedQuestion = question.trim();

    if (!trimmedQuestion) {
      setError("Please enter a question.");
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/rag/answer", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          question: trimmedQuestion,
          documentId,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        const message =
          payload && typeof payload.error === "string"
            ? payload.error
            : "Unable to answer this question right now.";

        throw new Error(message);
      }

      const result = normalizeRagAnswerPayload(payload);
      setAnswer(result.answer);
      setSources(result.chunks);
    } catch (requestError) {
      setAnswer("");
      setSources([]);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to answer this question right now.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="list-section parsed-text-section" aria-label="Ask this document">
      <div className="section-heading">
        <h2>Ask this document</h2>
        <p>Retrieve grounded answers from the stored chunks</p>
      </div>

      <form className="ask-document-form" onSubmit={handleSubmit}>
        <label className="form-field" htmlFor="document-question">
          <span>Your question</span>
          <textarea
            id="document-question"
            name="question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask about this study material"
            rows={4}
            disabled={!canAsk || isSubmitting}
            required
          />
        </label>

        {!canAsk ? (
          <p className="form-message warning">
            This document is not ready for RAG answers yet. Wait until processing is
            completed.
          </p>
        ) : null}

        {error ? <p className="form-message error">{error}</p> : null}

        <div className="button-row">
          <button className="button" type="submit" disabled={!canAsk || isSubmitting}>
            {isSubmitting ? "Asking..." : "Ask"}
          </button>
        </div>
      </form>

      {answer ? (
        <article className="card">
          <h3>Answer</h3>
          <p className="raw-text-preview">{answer}</p>
        </article>
      ) : null}

      {sources.length > 0 ? (
        <div className="list" aria-label="Answer sources">
          {sources.map((source) => {
            const previewAnalysis = analyzeSourcePreview(source.content);

            return (
              <article className="card source-card" key={source.id}>
                <h3>Chunk {source.chunkIndex}</h3>
                <p className="source-meta">
                  Similarity: {formatSourceSimilarity(source.similarity)}
                </p>
                {previewAnalysis.kind === "low_quality_preview" &&
                previewAnalysis.kind === "low_quality_preview" ? (
                  <>
                    <p className="form-message warning">{previewAnalysis.preview}</p>
                    {previewAnalysis.keywords.length > 0 ? (
                      <p className="source-keywords">
                        Keywords: {previewAnalysis.keywords.join(", ")}
                      </p>
                    ) : null}
                    {previewAnalysis.excerpt ? (
                      <p className="raw-text-preview source-excerpt">
                        Excerpt: {previewAnalysis.excerpt}
                      </p>
                    ) : null}
                  </>
                ) : (
                  <p className="raw-text-preview">{previewAnalysis.preview}</p>
                )}
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
