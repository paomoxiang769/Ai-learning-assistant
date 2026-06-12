import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const dashboardSource = await readFile(
  new URL("../src/app/dashboard/page.tsx", import.meta.url),
  "utf8",
);

test("dashboard renders a bento command center", () => {
  assert.match(dashboardSource, /bento-command-center/);
  assert.match(dashboardSource, /dashboard-command-grid/);
  assert.match(dashboardSource, /dashboard-learning-drawer/);
  assert.match(dashboardSource, /dashboard-route-chip/);
});

test("dashboard mirrors the target Bento study sections", () => {
  assert.match(dashboardSource, /Core Vitality/);
  assert.match(dashboardSource, /AI Daily Nexus/);
  assert.match(dashboardSource, /Active Synapse/);
  assert.match(dashboardSource, /study-synapse-map/);
  assert.match(dashboardSource, /study-synapse-cell/);
});
