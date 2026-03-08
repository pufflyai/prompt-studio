import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { TEST_TIMEOUT } from "./timeouts";

export const PSTDIO_CLI = join(import.meta.dirname, "../../../pstdio/src/index.ts");

export const createGitRepo = () => {
  const dir = mkdtempSync(join(tmpdir(), "pstdio-e2e-"));
  execSync("git init", { cwd: dir, stdio: "pipe" });
  execSync('git config user.email "test@test.com"', { cwd: dir, stdio: "pipe" });
  execSync('git config user.name "Test"', { cwd: dir, stdio: "pipe" });
  return dir;
};

export const createTempDir = () => mkdtempSync(join(tmpdir(), "pstdio-e2e-"));

export const runPstdio = (args: string, cwd: string, env: Record<string, string>) =>
  execSync(`bun run ${PSTDIO_CLI} ${args}`, {
    cwd,
    env: { ...process.env, ...env },
    encoding: "utf8",
    timeout: TEST_TIMEOUT,
  });

export const runPstdioSafe = (args: string, cwd: string, env: Record<string, string>) => {
  try {
    const stdout = execSync(`bun run ${PSTDIO_CLI} ${args}`, {
      cwd,
      env: { ...process.env, ...env },
      encoding: "utf8",
      timeout: TEST_TIMEOUT,
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
