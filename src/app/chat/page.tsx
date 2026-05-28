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
    <main className="page">
      <section className="page-header">
        <p className="eyebrow">Knowledge Base</p>
        <h1>Chat across your materials.</h1>
        <p>
          Ask one question across all processed study documents without binding the
          answer to a single file.
        </p>
      </section>

      <KnowledgeBaseChatForm
        canAsk={processedDocumentCount > 0}
        processedDocumentCount={processedDocumentCount}
      />

      <div className="button-row">
        <Link className="button secondary" href="/documents">
          Back to Documents
        </Link>
      </div>
    </main>
  );
}
