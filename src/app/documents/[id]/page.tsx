import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { normalizeDocumentChatMessages } from "@/lib/document-chat";
import { formatRawTextPreview } from "@/lib/raw-text-preview";
import { createClient } from "@/lib/supabase/server";
import { AskDocumentForm } from "./ask-document-form";
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
    <main className="page">
      <section className="page-header">
        <p className="eyebrow">Document detail</p>
        <h1>{userDocument.file_name}</h1>
        <p>Review the uploaded file details or manage this document.</p>
      </section>

      {query.error ? <p className="form-message error">{query.error}</p> : null}
      {query.warning ? <p className="form-message warning">{query.warning}</p> : null}

      <section className="grid grid-3" aria-label="Document details">
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
        className="list-section parsed-text-section"
        aria-label="AI summary"
      >
        <div className="section-heading">
          <h2>AI summary</h2>
          <p>Generated from parsed text</p>
        </div>
        <article className="card">
          <p className="raw-text-preview">{summaryText}</p>
        </article>
      </section>

      <section
        className="list-section parsed-text-section"
        aria-label="Parsed text preview"
      >
        <div className="section-heading">
          <h2>Raw text preview</h2>
          <p>First 500 characters</p>
        </div>
        <article className="card">
          <p className="raw-text-preview">{rawTextPreview}</p>
        </article>
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

      <div className="button-row">
        <Link className="button secondary" href="/documents">
          Back to Documents
        </Link>
        <Link className="button" href={`/api/documents/${userDocument.id}/download`}>
          Download
        </Link>
        <form action={`/api/documents/${userDocument.id}/delete`} method="post">
          <button className="button secondary" type="submit">
            Delete
          </button>
        </form>
      </div>
    </main>
  );
}
