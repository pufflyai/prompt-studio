import { resolve } from "node:path";

const windowMs = Number(process.env.PSTDIO_QUERY_EVENT_WINDOW_MS ?? 0);
if (!Number.isFinite(windowMs) || windowMs < 0)
  throw new Error("PSTDIO_QUERY_EVENT_WINDOW_MS must be finite and nonnegative");
const entries = [
  "api",
  "client",
  "extensions",
  "extensions/keyboard",
  "extensions/react",
  "prompts",
  "hooks",
  "resources",
  "testing",
  "data",
];
const result = Bun.spawnSync(
  [
    "bun",
    "build",
    ...entries.map((entry) => `./src/${entry}/index.ts`),
    "--outdir",
    "./dist",
    "--root",
    "./src",
    "--target",
    "browser",
    "--format",
    "esm",
    "--external",
    "mustache",
    "--external",
    "react",
    "--external",
    "@tanstack/react-query",
    "--external",
    "@tanstack/query-core",
    "--splitting",
    "--no-module-preload",
    "--external",
    "yjs",
    "--define",
    `__PSTDIO_QUERY_EVENT_WINDOW_MS__=${windowMs}`,
    ...process.argv.slice(2),
  ],
  {
    cwd: resolve(import.meta.dirname, ".."),
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  },
);
if (result.exitCode) process.exit(result.exitCode);
console.log(`SDK automatic-query event window: ${windowMs} ms`);
