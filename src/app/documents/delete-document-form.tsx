"use client";

import { useState } from "react";

type DeleteDocumentFormProps = {
  documentId: string;
  fileName: string;
};

export function DeleteDocumentForm({
  documentId,
  fileName,
}: DeleteDocumentFormProps) {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  return (
    <form action={`/api/documents/${documentId}/delete`} method="post">
      <button
        className="button secondary"
        type="button"
        onClick={() => setIsConfirmingDelete(true)}
      >
        Delete
      </button>

      {isConfirmingDelete ? (
        <div className="ui-modal-backdrop" role="presentation">
          <section
            aria-labelledby="delete-document-title"
            aria-modal="true"
            className="ui-modal-card"
            role="dialog"
          >
            <div className="ui-modal-header">
              <div>
                <span className="panel-kicker">Confirm delete</span>
                <h3 id="delete-document-title">Delete document?</h3>
              </div>
              <button
                aria-label="Close delete document dialog"
                className="ui-modal-close"
                type="button"
                onClick={() => setIsConfirmingDelete(false)}
              >
                X
              </button>
            </div>
            <p>
              This removes "{fileName}" and its saved study workspace from your
              document library.
            </p>
            <div className="button-row compact-button-row">
              <button
                className="button secondary"
                type="button"
                onClick={() => setIsConfirmingDelete(false)}
              >
                Cancel
              </button>
              <button className="button" type="submit">
                Delete
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </form>
  );
}
