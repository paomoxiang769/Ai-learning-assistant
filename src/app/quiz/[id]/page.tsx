import Link from "next/link";

type QuizPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function QuizPage({ params }: QuizPageProps) {
  const { id } = await params;

  return (
    <main className="page">
      <section className="page-header">
        <p className="eyebrow">Quiz</p>
        <h1>Quiz: {id}</h1>
        <p>
          This route is a static quiz skeleton. Question generation, answer
          checking, scoring, and attempt storage are intentionally deferred.
        </p>
      </section>

      <section className="card" aria-label="Quiz placeholder">
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
