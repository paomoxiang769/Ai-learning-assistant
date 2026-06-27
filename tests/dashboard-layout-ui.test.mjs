import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const dashboardSource = await readFile(
  new URL("../src/app/dashboard/page.tsx", import.meta.url),
  "utf8",
);

test("dashboard renders the release candidate command surface", () => {
  assert.match(dashboardSource, /dashboard-redesign-container/);
  assert.match(dashboardSource, /dashboard-redesign-header/);
  assert.match(dashboardSource, /get-started-panel/);
  assert.match(dashboardSource, /premium-stats-grid/);
});

test("dashboard mirrors the release candidate study sections", () => {
  assert.match(dashboardSource, /Recommended study modes/);
  assert.match(dashboardSource, /Study Intelligence/);
  assert.match(dashboardSource, /DashboardGlobalSearch/);
  assert.match(dashboardSource, /WeaknessDetectionCard/);
  assert.match(dashboardSource, /StudyPlanCard/);
});
