import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type QuizPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function QuizPage({ params }: QuizPageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="dashboard-redesign-container workspace-page">
      <header className="workspace-dashboard-header">
        <div>
          <p className="eyebrow">Quiz</p>
          <h1>Quiz Workspace</h1>
        </div>
        <div className="time-pill-selector" aria-label="Quiz workspace status">
          <span className="time-pill active">Skeleton</span>
        </div>
      </header>

      <section className="workspace-hero" aria-label="Quiz overview">
        <div>
          <p className="eyebrow">Quiz</p>
          <h2>Quiz workspace</h2>
          <p>
            This route is a static quiz skeleton. Question generation, answer
            checking, scoring, and attempt storage are intentionally deferred.
          </p>
        </div>
        <aside className="workspace-hero-card">
          <span className="panel-kicker">Document</span>
          <strong>{id}</strong>
          <p>Open the source document to continue with saved quiz tools.</p>
        </aside>
      </section>

      <section className="card quiz-placeholder-card tactile-question-card" aria-label="Quiz placeholder">
        <span className="panel-kicker">Practice placeholder</span>
        <h2>Question placeholder</h2>
        <p>
          Future quiz questions will appear here after document processing and
          quiz generation are implemented.
        </p>
      </section>

      <div className="button-row">
        <Link className="button secondary" href="/dashboard">
          Back to Dashboard
        </Link>
        <Link className="button secondary" href={`/documents/${id}`}>
          View Document Skeleton
        </Link>
      </div>
    </main>
  );
}
