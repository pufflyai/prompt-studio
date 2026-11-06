import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { startLocalWorkspaceRegistry } from "../local-workspace-registry";
import { preparedUiSourcesPath } from "./prepare-ui-fixtures";

const repoRoot = join(import.meta.dirname, "../../../..");
const defaults = JSON.parse(process.env.PSTDIO_DEFAULT_EXTENSIONS!);
// This is the same built-package registry/staged source mechanism as the packaged core smoke.
// Published compatibility remains the separate published_extensions check's responsibility.
const sources = JSON.parse(
  process.env.E2E_EXTENSION_SOURCES ?? (await readFile(preparedUiSourcesPath(process.env.E2E_HOME!), "utf8")),
) as Record<string, string>;
for (const entry of defaults.defaultExtensions) {
  const source = sources[entry.installName];
  if (!source) continue;
  entry.source = source;
  if (entry.installName === "extension-lab") entry.skipInstall = true;
  else delete entry.skipInstall;
}
const npmConfigPath = join(process.env.E2E_HOME!, ".npmrc");
const registry = await startLocalWorkspaceRegistry({
  configPath: npmConfigPath,
  outputRoot: join(process.env.E2E_HOME!, "ui-registry"),
  packagePaths: [join(repoRoot, "packages/sdk"), join(repoRoot, "packages/ui")],
});
const child = Bun.spawn(
  [process.execPath, "--conditions=source", "src/index.ts", "serve", "--foreground", ...process.argv.slice(2)],
  {
    cwd: join(repoRoot, "packages/pstdio"),
    env: {
      ...process.env,
      E2E_EXTENSION_SOURCES: JSON.stringify(sources),
      NPM_CONFIG_USERCONFIG: npmConfigPath,
      BUN_INSTALL_CACHE_DIR: process.env.E2E_BUN_CACHE_DIR ?? process.env.BUN_INSTALL_CACHE_DIR,
      PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify(defaults),
      // Keep provisioning/harness failures after the launcher removes its isolated home.
      PSTDIO_LOG_PATH: join(repoRoot, "packages/e2e/test-results", process.env.E2E_RUN_ID!, "runtime.jsonl"),
    },
    stdout: "inherit",
    stderr: "inherit",
  },
);
const forward = (signal: NodeJS.Signals) => child.kill(signal);
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, forward);
try {
  process.exitCode = await child.exited;
} finally {
  for (const signal of ["SIGINT", "SIGTERM"] as const) process.off(signal, forward);
  await registry.close();
}
