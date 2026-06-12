import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { normalizeDocumentChatMessages } from "@/lib/document-chat";
import { formatRawTextPreview } from "@/lib/raw-text-preview";
import { createClient } from "@/lib/supabase/server";
import { AskDocumentForm } from "./ask-document-form";
import { DeleteDocumentForm } from "../delete-document-form";
import { StudyNotesPanel } from "./study-notes-panel";
import { StudyQuizPanel } from "./study-quiz-panel";

type DocumentDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    error?: string;
    warning?: string;
    quizId?: string;
    noteId?: string;
  }>;
};

type DocumentRow = {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  created_at: string;
  raw_text: string | null;
  summary: string | null;
  processing_status: "pending" | "completed" | "failed";
};

type DocumentChatMessageRow = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources: unknown;
  created_at: string;
};

function formatUploadDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getRawTextPreview(rawText: string | null) {
  return formatRawTextPreview(rawText, 500);
}

function getSummaryText(summary: string | null) {
  if (!summary) {
    return "AI summary is not available yet.";
  }

  return summary;
}

export default async function DocumentDetailPage({
  params,
  searchParams,
}: DocumentDetailPageProps) {
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: document, error: documentError } = await supabase
    .from("documents")
    .select(
      "id, file_name, file_path, file_type, created_at, raw_text, summary, processing_status",
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (documentError) {
    throw new Error("Unable to load document.");
  }

  if (!document) {
    notFound();
  }

  const userDocument = document as DocumentRow;
  const { data: chatMessages, error: chatMessagesError } = await supabase
    .from("document_chat_messages")
    .select("id, role, content, sources, created_at")
    .eq("document_id", userDocument.id)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (chatMessagesError) {
    throw new Error("Unable to load chat history.");
  }

  const initialMessages = normalizeDocumentChatMessages(
    (chatMessages ?? []) as DocumentChatMessageRow[],
  );
  const rawTextLength = userDocument.raw_text?.length ?? 0;
  const rawTextPreview = getRawTextPreview(userDocument.raw_text);
  const summaryText = getSummaryText(userDocument.summary);
  const canAskDocument =
    userDocument.processing_status === "completed" && rawTextLength > 0;

  return (
    <main className="page document-workspace-page">
      <section className="workspace-hero document-workspace-hero" aria-label="Document overview">
        <div>
          <p className="eyebrow">Document detail</p>
          <h1>{userDocument.file_name}</h1>
          <p>Review the uploaded file details or manage this document.</p>
        </div>
        <aside className="workspace-hero-card">
          <span className="panel-kicker">Processing status</span>
          <strong>{userDocument.processing_status}</strong>
          <p>
            {canAskDocument
              ? "Ready for grounded chat, quiz generation, and notes."
              : "Learning tools unlock after processing completes."}
          </p>
        </aside>
      </section>

      {query.error ? <p className="form-message error">{query.error}</p> : null}
      {query.warning ? <p className="form-message warning">{query.warning}</p> : null}

      <section className="grid document-detail-meta document-meta-strip" aria-label="Document details">
        <article className="card">
          <h2>File name</h2>
          <p>{userDocument.file_name}</p>
        </article>
        <article className="card">
          <h2>File type</h2>
          <p>{userDocument.file_type}</p>
        </article>
        <article className="card">
          <h2>Uploaded</h2>
          <p>{formatUploadDate(userDocument.created_at)}</p>
        </article>
        <article className="card">
          <h2>Processing status</h2>
          <p>{userDocument.processing_status}</p>
        </article>
        <article className="card">
          <h2>Raw text length</h2>
          <p>{rawTextLength} characters</p>
        </article>
      </section>

      <section
        className="document-reader-grid paper-sync-shell"
        aria-label="Document reading workspace"
      >
        <aside className="paper-sync-outline" aria-label="Document outline">
          <span className="panel-kicker">Current mounted document</span>
          <div className="paper-sync-mounted-card">
            <strong>{userDocument.file_name}</strong>
            <p>
              {userDocument.file_type} - {rawTextLength} chars
            </p>
          </div>
          <div className="paper-sync-index">
            <span>Document knowledge index</span>
            <a href="#document-summary-section">AI summary</a>
            <a href="#document-preview-section">Raw text preview</a>
            <a href="#document-chat-section">Grounded chat</a>
            <a href="#quiz-section">Quiz arena</a>
            <a href="#notes-section">Study notes</a>
          </div>
        </aside>

        <div className="document-reader-main">
          <header className="paper-sync-header">
            <div>
              <span className="panel-kicker">Paper Sync</span>
              <h2>AI interactive reader</h2>
              <p>
                Summary, source preview, and study tools stay aligned to this
                document.
              </p>
            </div>
            <div className="paper-sync-status-grid" aria-label="Reader status">
              <span>{userDocument.file_type}</span>
              <span>{rawTextLength} chars</span>
              <strong>{canAskDocument ? "Ready" : "Processing"}</strong>
            </div>
          </header>

          <section
            className="list-section"
            aria-label="AI summary"
            id="document-summary-section"
          >
            <div className="section-heading">
              <div>
                <h2>AI summary</h2>
                <p>Generated from parsed text</p>
              </div>
            </div>
            <article className="card document-paper-card">
              <p className="raw-text-preview">{summaryText}</p>
            </article>
          </section>

          <section
            className="list-section"
            aria-label="Parsed text preview"
            id="document-preview-section"
          >
            <div className="section-heading">
              <div>
                <h2>Raw text preview</h2>
                <p>First 500 characters</p>
              </div>
            </div>
            <article className="card document-paper-card">
              <p className="raw-text-preview">{rawTextPreview}</p>
            </article>
          </section>
        </div>

        <aside className="document-reader-side paper-sync-extract-panel">
          <span className="panel-kicker">AI companion alignment</span>
          <h2>Study from this document</h2>
          <p>
            Use grounded chat first, then generate a quiz or save notes from the
            same source material.
          </p>
          <div className="paper-sync-focus-card" aria-label="AI extraction status">
            <span>AI extraction</span>
            <strong>{canAskDocument ? "Source aligned" : "Waiting for text"}</strong>
            <p>
              {canAskDocument
                ? "Grounded chat, quiz, and notes can now use this document."
                : "Processing must finish before study tools unlock."}
            </p>
          </div>
          <div className="activity-list">
            <div className="activity-row">
              <span>RAG chat</span>
              <strong>{canAskDocument ? "Ready" : "Locked"}</strong>
            </div>
            <div className="activity-row">
              <span>Quiz</span>
              <strong>{canAskDocument ? "Ready" : "Locked"}</strong>
            </div>
            <div className="activity-row">
              <span>Notes</span>
              <strong>{canAskDocument ? "Ready" : "Locked"}</strong>
            </div>
          </div>
        </aside>
      </section>

      <AskDocumentForm
        documentId={userDocument.id}
        canAsk={canAskDocument}
        initialMessages={initialMessages}
      />

      <StudyQuizPanel
        documentId={userDocument.id}
        canGenerate={canAskDocument}
        initialQuizId={query.quizId}
      />

      <StudyNotesPanel
        documentId={userDocument.id}
        canGenerate={canAskDocument}
        initialNoteId={query.noteId}
      />

      <div className="button-row document-action-row">
        <Link className="button secondary" href="/documents">
          Back to Documents
        </Link>
        <Link className="button" href={`/api/documents/${userDocument.id}/download`}>
          Download
        </Link>
        <DeleteDocumentForm
          documentId={userDocument.id}
          fileName={userDocument.file_name}
        />
      </div>
    </main>
  );
}
