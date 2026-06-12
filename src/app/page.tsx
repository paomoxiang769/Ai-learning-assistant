import Link from "next/link";

export default function HomePage() {
  return (
    <main className="page workspace-page">
      <section className="workspace-hero" aria-label="Study workspace overview">
        <div>
          <p className="eyebrow">Study workspace</p>
          <h1>Organize learning materials and practice from one place.</h1>
          <p>
            Move from upload to grounded chat, saved quizzes, notes, and review
            without leaving the learning loop.
          </p>
        </div>
        <aside className="workspace-hero-card">
          <span className="panel-kicker">Learning loop</span>
          <strong>AI</strong>
          <p>Documents, retrieval, quiz practice, notes, and review in one workspace.</p>
        </aside>
      </section>

      <section className="home-action-grid" aria-label="Primary actions">
        <Link className="card home-action-card" href="/dashboard">
          <span className="panel-kicker">Dashboard</span>
          <h2>Continue learning</h2>
          <p>Return to your study status, AI Review, and recent activity.</p>
        </Link>
        <Link className="card home-action-card" href="/documents">
          <span className="panel-kicker">Documents</span>
          <h2>Open materials</h2>
          <p>Upload documents and continue document-specific study workflows.</p>
        </Link>
      </section>
    </main>
  );
}
