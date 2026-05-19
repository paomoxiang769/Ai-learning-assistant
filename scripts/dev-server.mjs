import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const { PHASE_DEVELOPMENT_SERVER } = require("next/dist/shared/lib/constants");
const { startServer } = require("next/dist/server/lib/start-server");
const { setGlobal } = require("next/dist/trace/shared");

const projectDir = process.cwd();
const port = Number.parseInt(process.env.PORT ?? "3001", 10);
const hostname = process.env.HOSTNAME || undefined;
const distDir = path.join(projectDir, ".next");

process.env.NODE_ENV = "development";
setGlobal("phase", PHASE_DEVELOPMENT_SERVER);
setGlobal("distDir", distDir);

await startServer({
  dir: projectDir,
  port,
  allowRetry: true,
  isDev: true,
  hostname,
});

console.log(`Next dev server is running from ${path.basename(projectDir)}.`);
