import Link from "next/link";
import { redirect } from "next/navigation";
import { AiReviewCard } from "./ai-review-card";
import { DashboardGlobalSearch } from "./dashboard-global-search";
import { StudyPlanCard } from "./study-plan-card";
import { WeaknessDetectionCard } from "./weakness-detection-card";
import { loadDashboardOverview, loadDashboardSearchData } from "@/lib/dashboard";
import { createClient } from "@/lib/supabase/server";

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
  const searchData = await loadDashboardSearchData({
    supabase,
    userId: user.id,
  });
  
  const weeklyActivityCount =
    overview.studyActivitySummary.chats +
    overview.studyActivitySummary.quizzes +
    overview.studyActivitySummary.notes +
    overview.studyActivitySummary.flashcards;

  return (
    <main className="dashboard-redesign-container">
      {/* Header Section */}
      <header className="dashboard-redesign-header">
        <h1>Home</h1>
        <div className="time-pill-selector">
          <span className="time-pill active">Last 7 days</span>
        </div>
      </header>

      {/* Get Started Section */}
      <section className="get-started-panel" aria-label="Get started panel">
        <div className="get-started-steps-container">
          <div className="get-started-header">
            <h2>Get started</h2>
            <span className="get-started-context">2 steps</span>
          </div>
          
          <div className="get-started-step">
            <span className="get-started-step-icon" aria-hidden="true">🔑</span>
            <div className="get-started-step-copy">
              <strong>1. Upload study documents</strong>
              <p>Import PDFs, TXT, or markdown files to build your base.</p>
            </div>
          </div>

          <div className="get-started-step">
            <span className="get-started-step-icon" aria-hidden="true">📦</span>
            <div className="get-started-step-copy">
              <strong>2. Start study chat & quiz</strong>
              <p>Interact with the AI to ask questions or practice loops.</p>
            </div>
          </div>
        </div>

        <div className="get-started-gradient-panel">
          <Link className="glass-card" href="/chat">
            <div className="glass-card-title">
              <span>Study Quickstart</span>
              <span className="glass-card-arrow">↗</span>
            </div>
            <span className="glass-card-desc">Start chatting with your documents in minutes.</span>
          </Link>

          <Link className="glass-card" href="/review">
            <div className="glass-card-title">
              <span>Practice loop</span>
              <span className="glass-card-arrow">↗</span>
            </div>
            <span className="glass-card-desc">Generate quizzes to test your knowledge.</span>
          </Link>
        </div>
      </section>

      {/* Stats Section */}
      <section className="premium-stats-grid" aria-label="Study stats">
        <div className="stats-col-1">
          <Link className="stat-box" href="/documents">
            <div className="stat-box-title">
              <span>Total documents</span>
              <span>&gt;</span>
            </div>
            <span className="stat-box-value">{overview.totalDocuments}</span>
          </Link>
          
          <Link className="stat-box" href="/review">
            <div className="stat-box-title">
              <span>Saved quizzes</span>
              <span>&gt;</span>
            </div>
            <span className="stat-box-value">{overview.totalSavedQuizzes}</span>
          </Link>

          <Link className="stat-box" href="/review">
            <div className="stat-box-title">
              <span>Total Flashcards</span>
              <span>&gt;</span>
            </div>
            <span className="stat-box-value">{overview.totalFlashcards}</span>
          </Link>
        </div>

        <div className="stats-col-2">
          <div className="stat-box-tall">
            <div className="stat-box-title">
              <span>Total study actions</span>
              <span>&gt;</span>
            </div>
            <span className="stat-box-value">{weeklyActivityCount}</span>
            <span className="stat-box-subvalue">
              Recent flashcards {overview.studyActivitySummary.flashcards}
            </span>
          </div>
        </div>
      </section>

      {/* Search Section */}
      <DashboardGlobalSearch
        searchData={searchData}
        placeholder="Search documents, notes, quizzes, flashcards..."
      />

      {/* Recommended Study Modes */}
      <section aria-label="Recommended study modes">
        <h2 className="section-label">Recommended study modes</h2>
        <div className="recommended-modes-grid">
          <Link className="mode-card" href="/chat">
            <div className="mode-card-icon">💬</div>
            <h3 className="mode-card-title">Document Chat</h3>
            <p className="mode-card-desc">Chat with your AI study assistant about any document.</p>
          </Link>

          <Link className="mode-card" href="/chat">
            <div className="mode-card-icon">📂</div>
            <h3 className="mode-card-title">Knowledge Base</h3>
            <p className="mode-card-desc">Query across all uploaded study materials.</p>
          </Link>

          <Link className="mode-card" href="/review">
            <div className="mode-card-icon">📝</div>
            <h3 className="mode-card-title">Quiz Practice</h3>
            <p className="mode-card-desc">Practice with custom multiple-choice quizzes.</p>
          </Link>

          <Link className="mode-card" href="/review">
            <div className="mode-card-icon">🧠</div>
            <h3 className="mode-card-title">AI Review Center</h3>
            <p className="mode-card-desc">Review core concepts and study feedback.</p>
          </Link>

          <Link className="mode-card" href="/documents">
            <div className="mode-card-icon">📤</div>
            <h3 className="mode-card-title">Upload Center</h3>
            <p className="mode-card-desc">Import PDF, TXT or markdown files to get started.</p>
          </Link>
        </div>
      </section>

      {/* Tools Section */}
      <section aria-label="Study tools">
        <h2 className="section-label">Tools</h2>
        <div className="recommended-modes-grid">
          <Link className="mode-card" href="/documents">
            <div className="mode-card-icon">🔍</div>
            <h3 className="mode-card-title">Global Search</h3>
            <p className="mode-card-desc">Search documents, notes, quizzes, and flashcards.</p>
          </Link>

          <Link className="mode-card" href="/review">
            <div className="mode-card-icon">⚠️</div>
            <h3 className="mode-card-title">Weakness Detection</h3>
            <p className="mode-card-desc">Find topics most likely to need another pass.</p>
          </Link>

          <Link className="mode-card" href="/dashboard">
            <div className="mode-card-icon">💓</div>
            <h3 className="mode-card-title">Learning Pulse</h3>
            <p className="mode-card-desc">View your study metrics and weekly actions.</p>
          </Link>

          <Link className="mode-card" href="/review">
            <div className="mode-card-icon">📡</div>
            <h3 className="mode-card-title">Study Signal Map</h3>
            <p className="mode-card-desc">View your active study signals.</p>
          </Link>

          <Link className="mode-card" href="/dashboard">
            <div className="mode-card-icon">⚙️</div>
            <h3 className="mode-card-title">Settings</h3>
            <p className="mode-card-desc">Review local configuration and deployment readiness.</p>
          </Link>
        </div>
      </section>

      {/* Study Intelligence */}
      <section aria-label="Study intelligence center">
        <h2 className="section-label">Study Intelligence</h2>
        <div className="dashboard-ai-cards-row">
          <AiReviewCard
            hasStudyActivity={weeklyActivityCount > 0}
            mostStudiedDocumentTitle={overview.mostStudiedDocument?.title}
          />
          <div className="dashboard-review-stack">
            <WeaknessDetectionCard />
            <StudyPlanCard />
          </div>
        </div>
      </section>

      {/* Sign Out at the Bottom */}
      <footer className="dashboard-footer">
        <form action="/api/auth" method="post">
          <button
            className="button secondary dashboard-sign-out-button"
            name="auth_action"
            value="logout"
            type="submit"
          >
            Sign out
          </button>
        </form>
      </footer>
    </main>
  );
}
