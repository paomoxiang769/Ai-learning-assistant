import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildDashboardActivityFeed } from "../src/lib/dashboard-ui.ts";

const dashboardPageSource = await readFile(
  new URL("../src/app/dashboard/page.tsx", import.meta.url),
  "utf8",
);
const dashboardGlobalSearchSource = await readFile(
  new URL("../src/app/dashboard/dashboard-global-search.tsx", import.meta.url),
  "utf8",
);
const dashboardAiReviewCardSource = await readFile(
  new URL("../src/app/dashboard/ai-review-card.tsx", import.meta.url),
  "utf8",
);
const dashboardWeaknessDetectionCardSource = await readFile(
  new URL("../src/app/dashboard/weakness-detection-card.tsx", import.meta.url),
  "utf8",
);
const dashboardStudyPlanCardSource = await readFile(
  new URL("../src/app/dashboard/study-plan-card.tsx", import.meta.url),
  "utf8",
);
const globalsCssSource = await readFile(
  new URL("../src/app/globals.css", import.meta.url),
  "utf8",
);

function cssBlock(selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = globalsCssSource.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `Missing CSS block for ${selector}`);
  return match[1];
}

test("buildDashboardActivityFeed combines recent quizzes, chats, notes, and documents", () => {
  const feed = buildDashboardActivityFeed({
    recentQuizzes: [
      {
        id: "quiz-1",
        documentId: "document-1",
        documentTitle: "Neural Networks.pdf",
        questionCount: 8,
        createdAt: "2026-06-08T10:00:00.000Z",
        href: "/documents/document-1?quizId=quiz-1",
      },
    ],
    recentDocuments: [
      {
        id: "document-2",
        fileName: "Linear Algebra.pdf",
        processingStatus: "completed",
        createdAt: "2026-06-07T12:00:00.000Z",
        href: "/documents/document-2",
      },
    ],
    studyActivitySummary: {
      chats: 5,
      quizzes: 1,
      notes: 3,
      flashcards: 2,
    },
  });

  assert.deepEqual(feed, [
    {
      id: "quiz-quiz-1",
      label: "Created quiz",
      title: "Neural Networks.pdf",
      meta: "8 questions",
      href: "/documents/document-1?quizId=quiz-1",
    },
    {
      id: "chat-summary",
      label: "Asked questions",
      title: "5 chat messages this week",
      meta: "Recent document study chats",
      href: "/chat",
    },
    {
      id: "note-summary",
      label: "Added notes",
      title: "3 notes this week",
      meta: "Saved study observations",
      href: "/review",
    },
    {
      id: "flashcard-summary",
      label: "Generated flashcards",
      title: "2 flashcards this week",
      meta: "Saved quick review cards",
      href: "/review",
    },
    {
      id: "document-document-2",
      label: "Uploaded document",
      title: "Linear Algebra.pdf",
      meta: "Completed",
      href: "/documents/document-2",
    },
  ]);
});

test("buildDashboardActivityFeed returns an empty feed when there is no activity", () => {
  assert.deepEqual(
    buildDashboardActivityFeed({
      recentQuizzes: [],
      recentDocuments: [],
      studyActivitySummary: {
        chats: 0,
        quizzes: 0,
        notes: 0,
        flashcards: 0,
      },
    }),
    [],
  );
});

test("dashboard page renders global search", () => {
  assert.match(dashboardPageSource, /DashboardGlobalSearch/);
  assert.match(dashboardPageSource, /Search documents, notes, quizzes, flashcards\.\.\./);
});

test("dashboard page surfaces flashcard analytics", () => {
  assert.match(dashboardPageSource, /totalFlashcards/);
  assert.match(dashboardPageSource, /Recent flashcards/);
  assert.match(dashboardPageSource, /Total Flashcards|Flashcards/);
});

test("dashboard redesign shell renders the main study sections", () => {
  assert.match(dashboardPageSource, /dashboard-redesign-container/);
  assert.match(dashboardPageSource, /dashboard-redesign-header/);
  assert.match(dashboardPageSource, /get-started-panel/);
  assert.match(dashboardPageSource, /premium-stats-grid/);
  assert.match(dashboardPageSource, /Recommended study modes/);
  assert.match(dashboardPageSource, /Study Intelligence/);
});

test("dashboard page renders weakness detection below AI review", () => {
  assert.match(dashboardPageSource, /WeaknessDetectionCard/);
  assert.match(dashboardPageSource, /<AiReviewCard[\s\S]*<WeaknessDetectionCard/);
  assert.doesNotMatch(dashboardPageSource, /weakTopics=\{overview\.weakTopics\}/);
  assert.match(dashboardWeaknessDetectionCardSource, /\/api\/study\/weakness/);
  assert.match(dashboardWeaknessDetectionCardSource, /Weakness Detection/);
  assert.match(dashboardWeaknessDetectionCardSource, /Confidence/);
  assert.match(dashboardWeaknessDetectionCardSource, /Reason/);
  assert.match(dashboardWeaknessDetectionCardSource, /Suggested Action/);
  assert.match(dashboardWeaknessDetectionCardSource, /Not enough study activity yet\./);
});

test("dashboard page renders study plan below weakness detection", () => {
  assert.match(dashboardPageSource, /StudyPlanCard/);
  assert.match(dashboardPageSource, /<WeaknessDetectionCard[\s\S]*<StudyPlanCard/);
  assert.match(dashboardStudyPlanCardSource, /\/api\/study\/plan/);
  assert.match(dashboardStudyPlanCardSource, /AI Study Plan/);
  assert.match(dashboardStudyPlanCardSource, /Generate Study Plan/);
  assert.match(dashboardStudyPlanCardSource, /Regenerate Plan/);
  assert.match(dashboardStudyPlanCardSource, /Task/);
  assert.match(dashboardStudyPlanCardSource, /Reason/);
  assert.match(dashboardStudyPlanCardSource, /Recommended Action/);
  assert.match(dashboardStudyPlanCardSource, /Not enough study activity yet\./);
  assert.match(globalsCssSource, /\.study-plan-card/);
  assert.match(globalsCssSource, /\.study-plan-list/);
  assert.match(globalsCssSource, /\.study-plan-item/);
  assert.match(globalsCssSource, /\.study-plan-action/);
  assert.match(globalsCssSource, /\.study-plan-reason/);
});

test("dashboard global search uses lightweight grouped result cards", () => {
  assert.match(dashboardGlobalSearchSource, /\/api\/study\/search/);
  assert.match(dashboardGlobalSearchSource, /Search Results/);
  assert.match(dashboardGlobalSearchSource, /Relevance/);
  assert.match(dashboardGlobalSearchSource, /Semantic search unavailable; showing keyword matches\./);
  assert.match(dashboardGlobalSearchSource, /Keyword match/);
  assert.match(dashboardGlobalSearchSource, /flashcards/);
  assert.match(dashboardGlobalSearchSource, /search-result-card-grid/);
  assert.match(dashboardGlobalSearchSource, /search-result-group-card/);
  assert.match(dashboardGlobalSearchSource, /search-result-group-header/);
  assert.match(dashboardGlobalSearchSource, /search-result-count/);
  assert.match(dashboardGlobalSearchSource, /search-result-card/);
  assert.match(dashboardGlobalSearchSource, /search-result-type/);
});

test("dashboard global search result groups use BorderGlow", () => {
  assert.match(dashboardGlobalSearchSource, /import \{ BorderGlow \} from "@\/components\/border-glow";/);
  assert.match(
    dashboardGlobalSearchSource,
    /<BorderGlow[^>]+className="search-result-group search-result-group-card"/,
  );
  assert.match(globalsCssSource, /\.search-result-group-card\.border-glow-card > \.border-glow-inner/);
});

test("dashboard global search renders unified semantic results with client fallback", () => {
  assert.match(dashboardGlobalSearchSource, /useEffect/);
  assert.match(dashboardGlobalSearchSource, /AbortController/);
  assert.match(dashboardGlobalSearchSource, /buildKeywordSearchResults/);
  assert.match(dashboardGlobalSearchSource, /isSemanticSearchResponse/);
  assert.match(dashboardGlobalSearchSource, /setDidUseClientFallback\(true\)/);
  assert.match(dashboardGlobalSearchSource, /search-result-relevance/);
  assert.match(globalsCssSource, /\.search-result-card-meta/);
  assert.match(globalsCssSource, /\.search-result-relevance/);
});

test("get started panel keeps its plain redesigned section layout without BorderGlow", () => {
  assert.match(
    dashboardPageSource,
    /<section className="get-started-panel" aria-label="Get started panel">/,
  );
  assert.doesNotMatch(dashboardPageSource, /<BorderGlow\s+as="section"\s+className="get-started-panel"/);
  assert.doesNotMatch(globalsCssSource, /\.get-started-panel\.border-glow-card/);
});

test("dashboard stat grid keeps stable plain card sizing", () => {
  const statBoxBlock = cssBlock(".stat-box");
  const statTallBlock = cssBlock(".stat-box-tall");

  assert.match(dashboardPageSource, /className="premium-stats-grid"/);
  assert.match(statBoxBlock, /min-height:\s*110px;/);
  assert.match(statBoxBlock, /border-radius:\s*12px;/);
  assert.match(statTallBlock, /min-height:\s*232\.5px;/);
  assert.match(statTallBlock, /justify-content:\s*space-between;/);
});

test("dashboard statistic cards use restrained plain links", () => {
  assert.match(dashboardPageSource, /<Link className="stat-box" href="\/documents">/);
  assert.match(dashboardPageSource, /<Link className="stat-box" href="\/review">/);
  assert.match(dashboardPageSource, /className="stat-box-tall"/);
  assert.match(globalsCssSource, /\.stat-box\s*\{[\s\S]*background:\s*#ffffff;/);
  assert.doesNotMatch(dashboardPageSource, /<BorderGlow\s+className="card stat-card"/);
});

test("recommended mode cards keep direct navigation links", () => {
  assert.match(dashboardPageSource, /<Link className="mode-card" href="\/chat">/);
  assert.match(dashboardPageSource, /<Link className="mode-card" href="\/review">/);
  assert.match(dashboardPageSource, /<Link className="mode-card" href="\/documents">/);
  assert.match(globalsCssSource, /\.mode-card\s*\{[\s\S]*min-height:\s*170px;/);
});

test("dashboard cards use the BorderGlow wrapper and dashboard-only glow styles", async () => {
  const borderGlowSource = await readFile(
    new URL("../src/components/border-glow.tsx", import.meta.url),
    "utf8",
  );

  assert.match(borderGlowSource, /"use client"/);
  assert.match(borderGlowSource, /type BorderGlowProps/);
  assert.match(borderGlowSource, /as: Component = "article"/);
  assert.match(borderGlowSource, /onPointerMove=\{handlePointerMove\}/);
  assert.match(borderGlowSource, /sweep-active/);

  assert.match(dashboardAiReviewCardSource, /import \{ BorderGlow \} from "@\/components\/border-glow";/);
  assert.match(dashboardWeaknessDetectionCardSource, /<BorderGlow[^>]+className="card weakness-detection-card"/);
  assert.match(dashboardStudyPlanCardSource, /<BorderGlow[^>]+className="card study-plan-card"/);
  assert.match(dashboardAiReviewCardSource, /<BorderGlow[^>]+className="card ai-review-card"/);

  assert.match(globalsCssSource, /\.border-glow-card/);
  assert.match(globalsCssSource, /\.dashboard-ai-cards-row \.border-glow-card/);
  assert.match(globalsCssSource, /\.border-glow-inner/);
});

test("BorderGlow smooths pointer interaction and keeps hover feedback alive", async () => {
  const borderGlowSource = await readFile(
    new URL("../src/components/border-glow.tsx", import.meta.url),
    "utf8",
  );

  assert.match(borderGlowSource, /cachedRectRef/);
  assert.match(borderGlowSource, /motionRef/);
  assert.match(borderGlowSource, /requestAnimationFrame\(tickPointerMotion\)/);
  assert.match(borderGlowSource, /onPointerEnter=\{handlePointerEnter\}/);
  assert.match(borderGlowSource, /onPointerLeave=\{handlePointerLeave\}/);
  assert.match(borderGlowSource, /hover-active/);
  assert.match(borderGlowSource, /HOVER_EDGE_FLOOR/);
  assert.match(globalsCssSource, /@keyframes borderGlowBreathe/);
  assert.match(globalsCssSource, /\.border-glow-card\.hover-active:not\(:hover\)/);
  assert.match(globalsCssSource, /\.border-glow-card\.hover-active > \.edge-light::before/);
});

test("dashboard header keeps its plain non-BorderGlow controls", () => {
  assert.match(dashboardPageSource, /<header className="dashboard-redesign-header">/);
  assert.match(dashboardPageSource, /className="time-pill-selector"/);
  assert.match(dashboardPageSource, /Last 7 days/);
  assert.doesNotMatch(dashboardPageSource, /<BorderGlow\s+as="header"\s+className="dashboard-redesign-header"/);
  assert.doesNotMatch(dashboardPageSource, /<BorderGlow\s+as="div"\s+className="time-pill-selector"/);
  assert.doesNotMatch(dashboardPageSource, /get-started-dismiss-btn/);
  assert.doesNotMatch(dashboardPageSource, /style=\{\{/);
  assert.match(globalsCssSource, /\.dashboard-footer/);
  assert.match(globalsCssSource, /\.dashboard-sign-out-button/);
  assert.doesNotMatch(dashboardPageSource, /edgeOnly/);
  assert.doesNotMatch(globalsCssSource, /\.border-glow-card\.edge-only/);
});

test("global shell uses a monochrome OpenAI Platform style", async () => {
  const borderGlowSource = await readFile(
    new URL("../src/components/border-glow.tsx", import.meta.url),
    "utf8",
  );

  assert.match(globalsCssSource, /--canvas: #f7f7f7;/);
  assert.match(globalsCssSource, /--brand: #111111;/);
  assert.match(globalsCssSource, /--accent-soft: #eeeeee;/);
  assert.match(globalsCssSource, /\.app-sidebar \{[\s\S]*background: #f2f2f2;/);
  assert.match(globalsCssSource, /\.button \{[\s\S]*background: #111111;/);
  assert.doesNotMatch(globalsCssSource, /\.button \{[\s\S]*linear-gradient\(135deg, #4f46e5, #2563eb\)/);
  assert.doesNotMatch(globalsCssSource, /\.sidebar-brand-mark \{[\s\S]*#7c3aed/);
  assert.match(borderGlowSource, /colors = \["#111827", "#737373", "#d4d4d4"\]/);
});

test("dashboard surfaces avoid saturated gradient backgrounds", () => {
  assert.match(globalsCssSource, /\.bento-command-center \{[\s\S]*background: #ffffff;/);
  assert.doesNotMatch(globalsCssSource, /\.dashboard-hero-copy \{[\s\S]*rgba\(79, 70, 229/);
  assert.doesNotMatch(globalsCssSource, /\.dashboard-status-panel \{[\s\S]*rgba\(245, 158, 11/);
  assert.doesNotMatch(globalsCssSource, /\.bento-command-center \{[\s\S]*background: #0f172a;/);
  assert.doesNotMatch(dashboardPageSource, /#06b6d4|#10b981|#4f46e5|#2563eb/);
});
