import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const globalsCss = await readFile(
  new URL("../src/app/globals.css", import.meta.url),
  "utf8",
);

test("global styles expose the target UI design tokens", () => {
  assert.match(globalsCss, /--canvas:\s*#f7f7f7;/);
  assert.match(globalsCss, /--workspace:\s*#ffffff;/);
  assert.match(globalsCss, /--ink:\s*#111111;/);
  assert.match(globalsCss, /--brand:\s*#111111;/);
  assert.match(globalsCss, /--brand-soft:\s*#eeeeee;/);
  assert.match(globalsCss, /--panel-radius:\s*8px;/);
  assert.match(globalsCss, /--control-radius:\s*8px;/);
  assert.match(globalsCss, /--shadow-crisp:\s*0 1px 2px rgba\(0,\s*0,\s*0,\s*0\.04\);/);
});

test("common cards and controls use compact SaaS styling", () => {
  assert.match(globalsCss, /\.card,[\s\S]*?border-radius:\s*var\(--panel-radius\);/);
  assert.match(globalsCss, /\.card,[\s\S]*?background:\s*var\(--surface-card\);/);
  assert.match(globalsCss, /\.button\s*\{[\s\S]*?border-radius:\s*var\(--control-radius\);/);
  assert.match(globalsCss, /\.button\s*\{[\s\S]*?font-size:\s*0\.82rem;/);
  assert.match(globalsCss, /\.ui-modal-card\s*\{[\s\S]*?border-radius:\s*var\(--panel-radius\);/);
});
