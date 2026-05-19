import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type DocumentDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    error?: string;
  }>;
};

type DocumentRow = {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  created_at: string;
};

function formatUploadDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
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
    .select("id, file_name, file_path, file_type, created_at")
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

  return (
    <main className="page">
      <section className="page-header">
        <p className="eyebrow">Document detail</p>
        <h1>{userDocument.file_name}</h1>
        <p>Review the uploaded file details or manage this document.</p>
      </section>

      {query.error ? <p className="form-message error">{query.error}</p> : null}

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
      </section>

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
