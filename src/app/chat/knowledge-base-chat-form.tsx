"use client";

import { useState, type FormEvent } from "react";
import { ChatMarkdown } from "@/components/chat-markdown";
import {
  buildDocumentChatHistory,
  type DocumentChatMessage,
} from "@/lib/document-chat";
import {
  getDocumentChatViewModel,
  getSourcesSummaryLabel,
} from "@/lib/document-chat-ui";
import {
  analyzeSourcePreview,
  formatSourceSimilarity,
  normalizeRagAnswerPayload,
} from "@/lib/rag-answer-client";

type KnowledgeBaseChatFormProps = {
  canAsk: boolean;
  processedDocumentCount: number;
};

function createMessageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function KnowledgeBaseChatForm({
  canAsk,
  processedDocumentCount,
}: KnowledgeBaseChatFormProps) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<DocumentChatMessage[]>([]);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedQuestion = question.trim();

    if (!trimmedQuestion) {
      setError("Please enter a question.");
      return;
    }

    const requestHistory = buildDocumentChatHistory(messages);
    const userMessage: DocumentChatMessage = {
      id: createMessageId(),
      role: "user",
      content: trimmedQuestion,
      sources: [],
    };

    setError("");
    setQuestion("");
    setMessages((currentMessages) => [...currentMessages, userMessage]);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/rag/answer", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          question: trimmedQuestion,
          history: requestHistory,
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

      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: createMessageId(),
          role: "assistant",
          content: result.answer,
          sources: result.chunks,
        },
      ]);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to answer this question right now.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const viewModel = getDocumentChatViewModel({
    canAsk,
    isSubmitting,
    messageCount: messages.length,
  });

  return (
    <section
      className="list-section knowledge-chat-panel knowledge-command-shell"
      aria-label="Knowledge base chat"
    >
      <div className="section-heading">
        <div>
          <h2>Knowledge base chat</h2>
          <p>{processedDocumentCount} processed documents</p>
        </div>
      </div>

      <div className="knowledge-console-grid">
        <form
          className="ask-document-form knowledge-chat-form knowledge-prompt-dock"
          onSubmit={handleSubmit}
        >
          <label className="form-field" htmlFor="knowledge-base-question">
            <span>Your question</span>
            <textarea
              id="knowledge-base-question"
              name="question"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Compare KMP and Rabin-Karp from my materials"
              rows={4}
              disabled={viewModel.disableAsk}
              required
            />
          </label>

          {!canAsk ? (
            <p className="form-message warning">
              Upload and process at least one document before using knowledge base chat.
            </p>
          ) : null}

          {error ? <p className="form-message error">{error}</p> : null}

          <div className="button-row">
            <button className="button" type="submit" disabled={viewModel.disableAsk}>
              Ask
            </button>
          </div>
        </form>

        <aside className="knowledge-source-rail" aria-label="Knowledge source status">
          <span className="panel-kicker">Source rail</span>
          <h3>{processedDocumentCount} processed sources</h3>
          <div className="activity-list">
            <div className="activity-row">
              <span>Mode</span>
              <strong>Cross-doc</strong>
            </div>
            <div className="activity-row">
              <span>History</span>
              <strong>{messages.length}</strong>
            </div>
            <div className="activity-row">
              <span>Citations</span>
              <strong>Visible</strong>
            </div>
          </div>
        </aside>
      </div>

      {viewModel.showEmptyState ? (
        <article className="card chat-empty-state knowledge-empty-state knowledge-answer-stream">
          <p>Ask across all your processed materials.</p>
        </article>
      ) : (
        <div
          className="chat-thread knowledge-answer-stream"
          aria-label="Knowledge base chat history"
        >
          {messages.map((message) => (
            <article
              className={`card chat-message ${message.role === "user" ? "chat-message-user" : "chat-message-assistant"}`}
              key={message.id}
            >
              <div className="chat-message-header">
                <h3>{message.role === "user" ? "You" : "AI answer"}</h3>
              </div>

              {message.role === "assistant" ? (
                <ChatMarkdown content={message.content} />
              ) : (
                <p className="chat-message-text raw-text-preview">{message.content}</p>
              )}

              {message.role === "assistant" && message.sources.length > 0 ? (
                <details className="source-panel">
                  <summary className="source-panel-summary">
                    {getSourcesSummaryLabel(message.sources.length)}
                  </summary>

                  <div className="list source-list" aria-label="Answer sources">
                    {message.sources.map((source) => {
                      const previewAnalysis = analyzeSourcePreview(source.content);

                      return (
                        <article className="card source-card" key={source.id}>
                          <h3 className="source-document-title">
                            {source.documentTitle ?? source.documentId}
                          </h3>
                          <p className="source-meta">Chunk {source.chunkIndex}</p>
                          <p className="source-meta">
                            Similarity: {formatSourceSimilarity(source.similarity)}
                          </p>
                          {previewAnalysis.kind === "low_quality_preview" ? (
                            <>
                              <p className="form-message warning">
                                {previewAnalysis.preview}
                              </p>
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
                </details>
              ) : null}
            </article>
          ))}

          {viewModel.showThinkingState ? (
            <article
              className="card chat-message chat-message-assistant chat-message-thinking"
              role="status"
              aria-live="polite"
            >
              <div className="chat-message-header">
                <h3>AI answer</h3>
              </div>
              <p className="chat-message-text">AI is thinking...</p>
            </article>
          ) : null}
        </div>
      )}
    </section>
  );
}
