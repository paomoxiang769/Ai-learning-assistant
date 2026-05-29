"use client";

type DeleteDocumentFormProps = {
  documentId: string;
  fileName: string;
};

export function DeleteDocumentForm({
  documentId,
  fileName,
}: DeleteDocumentFormProps) {
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (!window.confirm(`Delete "${fileName}"?`)) {
      event.preventDefault();
    }
  }

  return (
    <form action={`/api/documents/${documentId}/delete`} method="post" onSubmit={handleSubmit}>
      <button className="button secondary" type="submit">
        Delete
      </button>
    </form>
  );
}
