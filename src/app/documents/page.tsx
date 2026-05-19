import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UploadForm } from "./upload-form";

type DocumentsPageProps = {
  searchParams: Promise<{
    error?: string;
    message?: string;
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

  return (
    <main className="page">
      <section className="page-header">
        <p className="eyebrow">Documents</p>
        <h1>Study materials</h1>
        <p>Upload PDF or TXT learning materials and keep them tied to your account.</p>
      </section>

      <UploadForm error={params.error} message={params.message} />

      <section className="list-section" aria-label="Uploaded document list">
        <div className="section-heading">
          <h2>Your files</h2>
          <p>{userDocuments.length} uploaded</p>
        </div>

        {documentsError ? (
          <p className="form-message error">{documentsError.message}</p>
        ) : null}

        {userDocuments.length === 0 && !documentsError ? (
          <article className="card">
            <h2>No documents yet</h2>
            <p>Your uploaded PDF and TXT files will appear here.</p>
          </article>
        ) : null}

        {userDocuments.length > 0 ? (
          <div className="list">
            {userDocuments.map((document) => (
              <article className="list-item" key={document.id}>
                <div>
                  <h2>{document.file_name}</h2>
                  <p>
                    {document.file_type} - {formatFileSize(document.file_size)} - Uploaded{" "}
                    {formatUploadDate(document.created_at)}
                  </p>
                </div>
                <Link className="button secondary" href={`/documents/${document.id}`}>
                  View
                </Link>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}
