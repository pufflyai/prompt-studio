import { type ChildProcess, spawn } from "node:child_process";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { resolveWorkingTreeDefaultExtensions } from "./working-tree-extensions";

const DEFAULT_API_URL = "http://127.0.0.1:19841";
const DEFAULT_DASHBOARD_URL = "http://localhost:5173";

export const resolveLocalDevelopmentEnv = (
  repoRoot: string,
  env: Record<string, string | undefined> = process.env,
) => ({
  ...env,
  PSTDIO_API_URL: env.PSTDIO_API_URL ?? DEFAULT_API_URL,
  PSTDIO_DEFAULT_EXTENSIONS:
    env.PSTDIO_DEFAULT_EXTENSIONS ?? JSON.stringify(resolveWorkingTreeDefaultExtensions(repoRoot)),
  PSTDIO_DISABLE_API_AUTO_START: env.PSTDIO_DISABLE_API_AUTO_START ?? "1",
  PSTDIO_DISABLE_EMBED_MANIFEST: env.PSTDIO_DISABLE_EMBED_MANIFEST ?? "1",
  PSTDIO_HOME: env.PSTDIO_HOME ?? resolve(env.HOME ?? homedir(), ".pstdio-dev"),
  PSTDIO_TERMINAL_ORIGINS: env.PSTDIO_TERMINAL_ORIGINS ?? DEFAULT_DASHBOARD_URL,
});

const waitForExit = (child: ChildProcess) =>
  new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolveExit, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => resolveExit({ code, signal }));
  });

const main = async () => {
  const repoRoot = resolve(import.meta.dirname, "../..");
  const env = resolveLocalDevelopmentEnv(repoRoot);
  const children = [
    spawn(
      "bun",
      ["packages/pstdio/src/index.ts", "--", "serve", "--foreground", "--host", "127.0.0.1", "--port", "19841"],
      { cwd: repoRoot, env, stdio: "inherit" },
    ),
    spawn("bun", ["run", "--cwd", "packages/pstdio-dashboard", "dev", "--", "--host", "localhost", "--port", "5173"], {
      cwd: repoRoot,
      env,
      stdio: "inherit",
    }),
  ];
  let interrupted = false;
  const stop = () => {
    interrupted = true;
    for (const child of children) child.kill("SIGTERM");
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);

  const exits = children.map(waitForExit);
  let firstExit: Awaited<(typeof exits)[number]> | undefined;
  try {
    firstExit = await Promise.race(exits);
  } finally {
    for (const child of children) child.kill("SIGTERM");
    await Promise.allSettled(exits);
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
  }
  if (!interrupted && firstExit?.code !== 0) process.exitCode = firstExit?.code ?? 1;
};

if (import.meta.main) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
