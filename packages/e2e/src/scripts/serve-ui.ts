import { join } from "node:path";

const repoRoot = join(import.meta.dirname, "../../../..");
const defaults = JSON.parse(process.env.PSTDIO_DEFAULT_EXTENSIONS!);
// Functional regressions install packed public packages; publication is checked separately.
if (!process.env.E2E_EXTENSION_SOURCES) throw new Error("Start UI tests with the test:ui launcher.");
const sources = JSON.parse(process.env.E2E_EXTENSION_SOURCES) as Record<string, string>;
for (const entry of defaults.defaultExtensions) {
  if (sources[entry.installName]) {
    entry.source = sources[entry.installName];
    entry.skipInstall = true;
  }
}

const child = Bun.spawn(
  [process.execPath, "--conditions=source", "src/index.ts", "serve", "--foreground", ...process.argv.slice(2)],
  {
    cwd: join(repoRoot, "packages/pstdio"),
    env: { ...process.env, PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify(defaults) },
    stdout: "inherit",
    stderr: "inherit",
  },
);
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => child.kill(signal));
process.exitCode = await child.exited;
