import Link from "next/link";

export default function HomePage() {
  return (
    <main className="page">
      <section className="page-header">
        <p className="eyebrow">Study workspace</p>
        <h1>Organize learning materials and practice from one place.</h1>
        <p>
          This is the first page skeleton for the AI Study Assistant. AI,
          database, upload, and quiz generation features are intentionally not
          implemented yet.
        </p>
      </section>

      <div className="button-row">
        <Link className="button" href="/dashboard">
          Open Dashboard
        </Link>
        <Link className="button secondary" href="/documents">
          View Documents
        </Link>
      </div>
    </main>
  );
}
