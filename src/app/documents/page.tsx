import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DocumentsSearchList, type DocumentsSearchItem } from "./documents-search-list";
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
  const documentItems: DocumentsSearchItem[] = userDocuments.map((document) => ({
    id: document.id,
    fileName: document.file_name,
    fileType: document.file_type,
    fileSize: document.file_size,
    createdAt: document.created_at,
    href: `/documents/${document.id}`,
  }));
  const totalLibrarySize = userDocuments.reduce(
    (totalSize, document) => totalSize + document.file_size,
    0,
  );

  return (
    <main className="dashboard-redesign-container workspace-page">
      <header className="workspace-dashboard-header">
        <div>
          <p className="eyebrow">Documents</p>
          <h1>Documents</h1>
        </div>
        <div className="time-pill-selector" aria-label="Document library status">
          <span className="time-pill active">Library</span>
        </div>
      </header>

      <section className="workspace-hero" aria-label="Documents overview">
        <div>
          <p className="eyebrow">Documents</p>
          <h2>Study materials</h2>
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
            <span>Library size</span>
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
            <DocumentsSearchList documents={documentItems} />
          ) : null}
        </section>
      </section>
    </main>
  );
}
