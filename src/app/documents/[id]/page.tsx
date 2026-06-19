import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { normalizeDocumentChatMessages } from "@/lib/document-chat";
import { formatRawTextPreview } from "@/lib/raw-text-preview";
import { createClient } from "@/lib/supabase/server";
import { AskDocumentForm } from "./ask-document-form";
import { DeleteDocumentForm } from "../delete-document-form";
import {
  DocumentWorkspaceTabs,
  type DocumentWorkspaceTab,
} from "./document-workspace-tabs";
import { StudyFlashcardsPanel } from "./study-flashcards-panel";
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
  const initialWorkspaceTab = query.quizId ? "quiz" : query.noteId ? "notes" : "overview";

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

      <DocumentWorkspaceTabs
        initialTab={initialWorkspaceTab as DocumentWorkspaceTab}
        overviewContent={
          <div className="document-overview-workspace">
            <section
              className="document-overview-grid"
              aria-label="Overview details"
            >
              <article className="card document-overview-card">
                <span className="panel-kicker">Document Title</span>
                <h2>{userDocument.file_name}</h2>
                <p>{userDocument.file_type}</p>
              </article>
              <article className="card document-overview-card">
                <span className="panel-kicker">Upload Time</span>
                <h2>{formatUploadDate(userDocument.created_at)}</h2>
                <p>Stored in your document library</p>
              </article>
              <article className="card document-overview-card">
                <span className="panel-kicker">Processing Status</span>
                <h2>{userDocument.processing_status}</h2>
                <p>
                  {canAskDocument
                    ? "Ready for grounded study tools"
                    : "Processing must complete before study tools unlock"}
                </p>
              </article>
            </section>

            <section
              className="list-section"
              aria-label="AI summary"
              id="document-summary-section"
            >
              <div className="section-heading">
                <div>
                  <h2>AI Summary</h2>
                  <p>Generated from parsed text</p>
                </div>
              </div>
              <article className="card document-paper-card">
                <p className="raw-text-preview">{summaryText}</p>
              </article>
            </section>

            <section className="list-section" aria-label="Document statistics">
              <div className="section-heading">
                <div>
                  <h2>Document statistics</h2>
                  <p>File and extraction signals</p>
                </div>
              </div>
              <div className="document-stat-grid">
                <article className="card">
                  <h3>File type</h3>
                  <p>{userDocument.file_type}</p>
                </article>
                <article className="card">
                  <h3>Raw text length</h3>
                  <p>{rawTextLength} characters</p>
                </article>
                <article className="card">
                  <h3>Study readiness</h3>
                  <p>{canAskDocument ? "Ready" : "Locked"}</p>
                </article>
              </div>
            </section>

            <details className="document-raw-text-disclosure">
              <summary>Raw Text Preview</summary>
              <div className="card document-paper-card">
                <p className="raw-text-preview">{rawTextPreview}</p>
              </div>
            </details>
          </div>
        }
        chatContent={
          <AskDocumentForm
            documentId={userDocument.id}
            canAsk={canAskDocument}
            initialMessages={initialMessages}
          />
        }
        quizContent={
          <StudyQuizPanel
            documentId={userDocument.id}
            canGenerate={canAskDocument}
            initialQuizId={query.quizId}
          />
        }
        notesContent={
          <StudyNotesPanel
            documentId={userDocument.id}
            canGenerate={canAskDocument}
            initialNoteId={query.noteId}
          />
        }
        flashcardsContent={
          <StudyFlashcardsPanel
            documentId={userDocument.id}
            canGenerate={canAskDocument}
          />
        }
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
