import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DeleteDocumentForm } from "./delete-document-form";
import { UploadForm } from "./upload-form";

type DocumentsPageProps = {
  searchParams: Promise<{
    error?: string;
    message?: string;
    warning?: string;
  }>;
};

type DocumentRow = {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  created_at: string;
};

function formatFileSize(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatUploadDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function DocumentsPage({ searchParams }: DocumentsPageProps) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: documents, error: documentsError } = await supabase
    .from("documents")
    .select("id, file_name, file_type, file_size, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const userDocuments = (documents ?? []) as DocumentRow[];
  const totalLibrarySize = userDocuments.reduce(
    (totalSize, document) => totalSize + document.file_size,
    0,
  );

  return (
    <main className="page workspace-page">
      <section className="workspace-hero" aria-label="Documents overview">
        <div>
          <p className="eyebrow">Documents</p>
          <h1>Study materials</h1>
          <p>Upload PDF or TXT learning materials and keep them tied to your account.</p>
        </div>
        <aside className="workspace-hero-card">
          <span className="panel-kicker">Library status</span>
          <strong>{userDocuments.length}</strong>
          <p>uploaded files ready for summaries, chat, quizzes, and notes.</p>
        </aside>
      </section>

      <section
        className="workspace-grid source-library-shell"
        aria-label="Document workspace"
      >
        <div className="workspace-side-panel source-upload-dock">
          <div className="section-heading compact-section-heading">
            <div>
              <h2>Upload</h2>
              <p>Add source material to your learning loop.</p>
            </div>
          </div>
          <UploadForm
            error={params.error}
            message={params.message}
            warning={params.warning}
          />
          <div className="source-library-meter" aria-label="Source library size">
            <span>Total shelf size</span>
            <strong>{formatFileSize(totalLibrarySize)}</strong>
          </div>
        </div>

        <section
          className="list-section workspace-main-panel source-shelf-panel"
          aria-label="Uploaded document list"
        >
          <div className="section-heading">
            <div>
              <span className="panel-kicker">Source shelf</span>
              <h2>Your files</h2>
              <p>{userDocuments.length} uploaded</p>
            </div>
          </div>

          {documentsError ? (
            <p className="form-message error">{documentsError.message}</p>
          ) : null}

          {userDocuments.length === 0 && !documentsError ? (
            <article className="card empty-card">
              <h2>No documents yet</h2>
              <p>Your uploaded PDF and TXT files will appear here.</p>
            </article>
          ) : null}

          {userDocuments.length > 0 ? (
            <div className="list source-shelf-grid">
              {userDocuments.map((document) => (
                <article
                  className="list-item workspace-list-item source-file-card"
                  key={document.id}
                >
                  <span className="source-lane-marker">{document.file_type}</span>
                  <div>
                    <span className="panel-kicker">{document.file_type}</span>
                    <h2>{document.file_name}</h2>
                    <p>
                      {formatFileSize(document.file_size)} - Uploaded{" "}
                      {formatUploadDate(document.created_at)}
                    </p>
                  </div>
                  <div className="list-item-actions">
                    <Link className="button secondary" href={`/documents/${document.id}`}>
                      View
                    </Link>
                    <DeleteDocumentForm
                      documentId={document.id}
                      fileName={document.file_name}
                    />
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      </section>
    </main>
  );
}
