import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { TEST_TIMEOUT } from "./timeouts";

export const PSTDIO_CLI = join(import.meta.dirname, "../../../pstdio/src/index.ts");

export const createGitRepo = () => {
  const dir = mkdtempSync(join(tmpdir(), "pstdio-e2e-"));
  // Keep e2e repos deterministic across environments where git default branch may differ.
  execSync("git init -b main", { cwd: dir, stdio: "pipe" });
  execSync('git config user.email "test@test.com"', { cwd: dir, stdio: "pipe" });
  execSync('git config user.name "Test"', { cwd: dir, stdio: "pipe" });
  return dir;
};

export const createTempDir = () => mkdtempSync(join(tmpdir(), "pstdio-e2e-"));

const createPstdioEnv = (env: Record<string, string>) => ({
  ...process.env,
  PSTDIO_DISABLE_EMBED_MANIFEST: "1",
  PSTDIO_DISABLE_API_AUTO_START: "1",
  ...env,
});

export const runPstdio = (args: string, cwd: string, env: Record<string, string>, timeout = TEST_TIMEOUT) =>
  execSync(`bun run ${PSTDIO_CLI} ${args}`, {
    cwd,
    env: createPstdioEnv(env),
    encoding: "utf8",
    timeout,
  });

export const runPstdioSafe = (args: string, cwd: string, env: Record<string, string>, timeout = TEST_TIMEOUT) => {
  try {
    const stdout = execSync(`bun run ${PSTDIO_CLI} ${args}`, {
      cwd,
      env: createPstdioEnv(env),
      encoding: "utf8",
      timeout,
    });
    return { stdout, stderr: "", exitCode: 0 };
  } catch (error: unknown) {
    const err = error as { stdout?: string; stderr?: string; status?: number };
    return {
      stdout: err.stdout ?? "",
      stderr: err.stderr ?? "",
      exitCode: err.status ?? 1,
    };
  }
};

export const createCliRunner = (apiUrl: string) => {
  const env = { PSTDIO_API_URL: apiUrl };

  return {
    run: (args: string, cwd: string, timeout = TEST_TIMEOUT) => runPstdio(args, cwd, env, timeout),
    runSafe: (args: string, cwd: string, timeout = TEST_TIMEOUT) => runPstdioSafe(args, cwd, env, timeout),
  };
};

export const createInitializedRepo = (input: {
  name: string;
  dirs: string[];
  run: (args: string, cwd: string) => string;
  withInitialCommit?: boolean;
}) => {
  const repo = createGitRepo();
  input.dirs.push(repo);

  if (input.withInitialCommit) {
    execSync("git commit --allow-empty -m init", { cwd: repo, stdio: "pipe" });
  }

  input.run(`projects create ${input.name}`, repo);
  return repo;
};

export const createProjectViaApi = async (apiUrl: string, name: string) => {
  const res = await fetch(`${apiUrl}/v1/projects`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name }),
  });
  return (await res.json()) as { id: string; name: string };
};

export const shutdownApiViaHttp = async (apiUrl: string) => {
  try {
    await fetch(`${apiUrl}/shutdown`, { method: "POST" });
  } catch {
    // already down
  }
};

export const gitRootBasename = (dir: string) => basename(dir);

export const cleanupDirs = (dirs: string[]) => {
  for (const dir of dirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  dirs.length = 0;
};
