import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { KnowledgeBaseChatForm } from "./knowledge-base-chat-form";

type DocumentRow = {
  id: string;
  file_name: string;
  processing_status: "pending" | "completed" | "failed";
};

export default async function KnowledgeBaseChatPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: documents, error: documentsError } = await supabase
    .from("documents")
    .select("id, file_name, processing_status")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (documentsError) {
    throw new Error("Unable to load knowledge base documents.");
  }

  const userDocuments = (documents ?? []) as DocumentRow[];
  const processedDocumentCount = userDocuments.filter(
    (document) => document.processing_status === "completed",
  ).length;

  return (
    <main className="dashboard-redesign-container workspace-page">
      <header className="workspace-dashboard-header">
        <div>
          <p className="eyebrow">Knowledge Base</p>
          <h1>Knowledge Base</h1>
        </div>
        <div className="time-pill-selector" aria-label="Knowledge base mode">
          <span className="time-pill active">Cross-document</span>
        </div>
      </header>

      <section className="workspace-hero" aria-label="Knowledge base overview">
        <div>
          <p className="eyebrow">Knowledge Base</p>
          <h2>Chat across your materials.</h2>
          <p>
            Ask one question across all processed study documents without binding the
            answer to a single file.
          </p>
        </div>
        <aside className="workspace-hero-card">
          <span className="panel-kicker">Retrieval scope</span>
          <strong>{processedDocumentCount}</strong>
          <p>processed documents available for cross-document answers.</p>
        </aside>
      </section>

      <section className="knowledge-workspace-grid" aria-label="Knowledge base workspace">
        <KnowledgeBaseChatForm
          canAsk={processedDocumentCount > 0}
          processedDocumentCount={processedDocumentCount}
        />

        <aside className="knowledge-side-panel">
          <span className="panel-kicker">AI companion</span>
          <h2>Cross-document retrieval</h2>
          <p>
            This mode searches across your processed documents and keeps the chat
            unbound to a single file by design.
          </p>
          <div className="activity-list">
            <div className="activity-row">
              <span>Processed sources</span>
              <strong>{processedDocumentCount}</strong>
            </div>
            <div className="activity-row">
              <span>Persistence</span>
              <strong>Session</strong>
            </div>
            <div className="activity-row">
              <span>Citations</span>
              <strong>Visible</strong>
            </div>
          </div>
        </aside>
      </section>

      <div className="button-row">
        <Link className="button secondary" href="/documents">
          Back to Documents
        </Link>
      </div>
    </main>
  );
}
