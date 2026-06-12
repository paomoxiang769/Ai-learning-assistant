import Link from "next/link";
import { redirect } from "next/navigation";
import { AiReviewCard } from "./ai-review-card";
import { loadDashboardOverview } from "@/lib/dashboard";
import { buildDashboardActivityFeed } from "@/lib/dashboard-ui";
import { createClient } from "@/lib/supabase/server";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getSynapseLevel(value: number) {
  if (value >= 8) {
    return "is-hot";
  }

  if (value >= 3) {
    return "is-warm";
  }

  if (value > 0) {
    return "is-active";
  }

  return "is-quiet";
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const overview = await loadDashboardOverview({
    supabase,
    userId: user.id,
  });
  const activityFeed = buildDashboardActivityFeed({
    recentDocuments: overview.recentDocuments,
    recentQuizzes: overview.recentQuizzes,
    studyActivitySummary: overview.studyActivitySummary,
  });
  const weeklyActivityCount =
    overview.studyActivitySummary.chats +
    overview.studyActivitySummary.quizzes +
    overview.studyActivitySummary.notes;
  const learningStatus =
    overview.processedDocuments > 0
      ? "Ready for focused study"
      : overview.totalDocuments > 0
        ? "Preparing your materials"
        : "Start your study base";
  const nextFocus =
    overview.mostStudiedDocument?.title ??
    overview.recentDocuments[0]?.fileName ??
    "Upload a document to begin";
  const recentDocument = overview.recentDocuments[0] ?? null;
  const recentQuiz = overview.recentQuizzes[0] ?? null;
  const stats = [
    {
      label: "Documents",
      value: overview.totalDocuments,
      helper: "All uploaded files",
    },
    {
      label: "Ready",
      value: overview.processedDocuments,
      helper: "Processed documents",
    },
    {
      label: "Quizzes",
      value: overview.totalSavedQuizzes,
      helper: "Saved practice sets",
    },
    {
      label: "Chats",
      value: overview.totalChatMessages,
      helper: "Study questions asked",
    },
    {
      label: "Notes",
      value: overview.totalNotes,
      helper: "Saved observations",
    },
  ];
  const synapseSignals = [
    {
      label: "Chats",
      value: overview.studyActivitySummary.chats,
    },
    {
      label: "Quizzes",
      value: overview.studyActivitySummary.quizzes,
    },
    {
      label: "Notes",
      value: overview.studyActivitySummary.notes,
    },
    {
      label: "Ready docs",
      value: overview.processedDocuments,
    },
    {
      label: "Saved sets",
      value: overview.totalSavedQuizzes,
    },
    {
      label: "Documents",
      value: overview.totalDocuments,
    },
  ];

  return (
    <main className="page dashboard-page">
      <section className="dashboard-hero" aria-label="Learning overview">
        <div className="dashboard-hero-copy">
          <p className="eyebrow">Learning dashboard</p>
          <h1>Your study workspace</h1>
          <p>
            Keep momentum across documents, review prompts, quizzes, and notes.
            Signed in as {user.email}
          </p>
          <div className="dashboard-hero-actions">
            {overview.mostStudiedDocument ? (
              <Link className="button" href={overview.mostStudiedDocument.href}>
                Resume focus
              </Link>
            ) : (
              <Link className="button" href="/documents">
                Add study material
              </Link>
            )}
            <Link className="button secondary" href="/review">
              Open review center
            </Link>
          </div>
        </div>

        <aside className="dashboard-status-panel">
          <span className="panel-kicker">Current status</span>
          <h2>{learningStatus}</h2>
          <p>{nextFocus}</p>
          <div className="dashboard-status-grid" aria-label="Weekly status">
            <div>
              <strong>{weeklyActivityCount}</strong>
              <span>actions this week</span>
            </div>
            <div>
              <strong>{overview.processedDocuments}</strong>
              <span>ready documents</span>
            </div>
          </div>
        </aside>
      </section>

      <section className="bento-command-center" aria-label="Bento study command center">
        <div className="dashboard-command-copy">
          <span className="panel-kicker">AI Daily Nexus</span>
          <h2>Study command center</h2>
          <p>
            Jump into the next useful action from one dense workspace: source
            reading, grounded chat, practice, or review.
          </p>
        </div>

        <div className="dashboard-command-grid" aria-label="Study routes">
          <Link className="dashboard-route-chip" href="/documents">
            <span>01</span>
            <strong>Source library</strong>
            <small>{overview.totalDocuments} documents</small>
          </Link>
          <Link className="dashboard-route-chip" href="/chat">
            <span>02</span>
            <strong>Knowledge chat</strong>
            <small>{overview.totalChatMessages} saved questions</small>
          </Link>
          <Link className="dashboard-route-chip" href="/review">
            <span>03</span>
            <strong>Review center</strong>
            <small>{weeklyActivityCount} weekly actions</small>
          </Link>
          <Link
            className="dashboard-route-chip"
            href={recentQuiz?.href ?? "/documents"}
          >
            <span>04</span>
            <strong>Practice loop</strong>
            <small>
              {recentQuiz ? `${recentQuiz.questionCount} questions` : "Create a quiz"}
            </small>
          </Link>
        </div>

        <aside className="dashboard-learning-drawer" aria-label="Current learning drawer">
          <span className="panel-kicker">Current drawer</span>
          <h3>{nextFocus}</h3>
          <div className="activity-list">
            <div className="activity-row">
              <span>Recent document</span>
              <strong>{recentDocument ? "Available" : "Empty"}</strong>
            </div>
            <div className="activity-row">
              <span>Recent quiz</span>
              <strong>{recentQuiz ? "Ready" : "None"}</strong>
            </div>
            <div className="activity-row">
              <span>AI review</span>
              <strong>{weeklyActivityCount > 0 ? "Seeded" : "Waiting"}</strong>
            </div>
          </div>
        </aside>
      </section>

      <section className="dashboard-primary-grid" aria-label="Study focus">
        <AiReviewCard
          hasStudyActivity={weeklyActivityCount > 0}
          mostStudiedDocumentTitle={overview.mostStudiedDocument?.title}
        />

        <section className="list-section continue-learning" aria-label="Continue learning">
          <div className="section-heading">
            <div>
              <h2>Continue learning</h2>
              <p>Pick up from the latest document or saved practice set.</p>
            </div>
          </div>

          <div className="continue-learning-stack">
            {recentDocument ? (
              <article className="card continue-card">
                <span className="panel-kicker">Recent document</span>
                <h3>{recentDocument.fileName}</h3>
                <p>
                  {recentDocument.processingStatus} - Uploaded{" "}
                  {formatDateTime(recentDocument.createdAt)}
                </p>
                <div className="button-row compact-button-row">
                  <Link className="button secondary" href={recentDocument.href}>
                    Continue document
                  </Link>
                </div>
              </article>
            ) : (
              <article className="card empty-card">
                <span className="panel-kicker">Recent document</span>
                <h3>No documents yet</h3>
                <p>Upload study material to unlock summaries, chat, notes, and quizzes.</p>
                <div className="button-row compact-button-row">
                  <Link className="button secondary" href="/documents">
                    Upload document
                  </Link>
                </div>
              </article>
            )}

            {recentQuiz ? (
              <article className="card continue-card">
                <span className="panel-kicker">Recent quiz</span>
                <h3>{recentQuiz.documentTitle}</h3>
                <p>
                  {recentQuiz.questionCount} questions - Saved{" "}
                  {formatDateTime(recentQuiz.createdAt)}
                </p>
                <div className="button-row compact-button-row">
                  <Link className="button secondary" href={recentQuiz.href}>
                    Continue quiz
                  </Link>
                </div>
              </article>
            ) : (
              <article className="card empty-card">
                <span className="panel-kicker">Recent quiz</span>
                <h3>No saved quizzes yet</h3>
                <p>Create a quiz from any processed document when you are ready to practice.</p>
              </article>
            )}
          </div>
        </section>
      </section>

      <section className="list-section dashboard-section" aria-label="Study analytics">
        <div className="section-heading">
          <div>
            <h2>Study analytics</h2>
            <p>Core learning signals from your documents, chats, quizzes, and notes.</p>
          </div>
        </div>

        <div className="grid dashboard-stats">
          {stats.map((stat) => (
            <article className="card stat-card" key={stat.label}>
              <h3>{stat.label}</h3>
              <p>{stat.value}</p>
              <span className="form-message">{stat.helper}</span>
            </article>
          ))}
        </div>

        <div className="dashboard-signal-grid">
          <article className="card study-vitality-card">
            <span className="panel-kicker">Core Vitality</span>
            <h3>Current learning pulse</h3>
            <div className="study-vitality-metrics" aria-label="Learning pulse">
              <div>
                <strong>{weeklyActivityCount}</strong>
                <span>weekly actions</span>
              </div>
              <div>
                <strong>{overview.totalSavedQuizzes}</strong>
                <span>saved practice sets</span>
              </div>
              <div>
                <strong>{overview.totalNotes}</strong>
                <span>study notes</span>
              </div>
            </div>
          </article>

          <article className="card study-synapse-card">
            <span className="panel-kicker">Active Synapse</span>
            <h3>Study signal map</h3>
            <div className="study-synapse-map" aria-label="Study signal map">
              {synapseSignals.map((signal) => (
                <div
                  className={`study-synapse-cell ${getSynapseLevel(signal.value)}`}
                  key={signal.label}
                >
                  <strong>{signal.value}</strong>
                  <span>{signal.label}</span>
                </div>
              ))}
            </div>
          </article>
        </div>

        <div className="grid dashboard-analytics-grid">
          <article className="card study-highlight-card">
            <span className="panel-kicker">Most studied document</span>
            {overview.mostStudiedDocument ? (
              <>
                <h3>{overview.mostStudiedDocument.title}</h3>
                <p>Highest combined activity across chats, quizzes, and notes.</p>
                <span className="study-score">
                  Study score {overview.mostStudiedDocument.score}
                </span>
                <div className="button-row">
                  <Link
                    className="button secondary"
                    href={overview.mostStudiedDocument.href}
                  >
                    Open document
                  </Link>
                </div>
              </>
            ) : (
              <>
                <h3>No study pattern yet</h3>
                <p>
                  Ask questions, save notes, or create quizzes to surface your
                  strongest study focus here.
                </p>
              </>
            )}
          </article>

          <article className="card">
            <span className="panel-kicker">Activity summary</span>
            <div className="activity-list">
              <div className="activity-row">
                <span>Chats this week</span>
                <strong>{overview.studyActivitySummary.chats}</strong>
              </div>
              <div className="activity-row">
                <span>Quizzes this week</span>
                <strong>{overview.studyActivitySummary.quizzes}</strong>
              </div>
              <div className="activity-row">
                <span>Notes this week</span>
                <strong>{overview.studyActivitySummary.notes}</strong>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section className="list-section dashboard-section" aria-label="Recent activity">
        <div className="section-heading">
          <div>
            <h2>Recent activity</h2>
            <p>A compact trail of what moved your learning forward.</p>
          </div>
        </div>

        {activityFeed.length > 0 ? (
          <div className="activity-feed">
            {activityFeed.map((item) => (
              <Link className="activity-feed-item" href={item.href} key={item.id}>
                <span>{item.label}</span>
                <strong>{item.title}</strong>
                <small>{item.meta}</small>
              </Link>
            ))}
          </div>
        ) : (
          <article className="card empty-card">
            <h3>No recent learning activity</h3>
            <p>
              Upload a document, ask a question, save a note, or create a quiz
              to populate this feed.
            </p>
          </article>
        )}
      </section>

      <form className="button-row" action="/api/auth" method="post">
        <button
          className="button secondary"
          name="auth_action"
          value="logout"
          type="submit"
        >
          Logout
        </button>
      </form>
    </main>
  );
}
