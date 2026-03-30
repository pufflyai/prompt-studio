import { beforeAll, describe, expect, test } from "bun:test";
import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildBinary } from "./packaged-helpers";

const BUILD_TIMEOUT = 180_000;
const SMOKE_TEST_TIMEOUT = 30_000;
const REPO_ROOT = join(import.meta.dirname, "../../../..");
const BINARY_PATH = join(REPO_ROOT, "dist/pstdio");
const REQUIRED_TEMPLATE_NAMES = [
  "adr",
  "changelog-entry",
  "commit-message",
  "cookbook",
  "create-sub-tickets",
  "implement-ticket",
  "lessons-learned",
  "prd",
  "proposal",
  "refine-ticket",
  "review-me",
  "squash-message",
  "ticket",
];
const REQUIRED_SKILL_NAMES = [
  "create-proposal",
  "create-sub-tickets",
  "create-ticket",
  "implement-ticket",
  "pstdio",
  "refine-ticket",
  "update-documentation",
  "write-pstdio-hook",
];
const REQUIRED_HOOK_NAMES = [
  "post-session-start",
  "post-session-success",
  "post-ticket-archive",
  "post-worktree-create",
];

const createCandidatePort = () => 42_000 + Math.floor(Math.random() * 200);

const waitForReady = async (baseUrl: string, timeoutMs = 10_000) => {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1_000);

    try {
      const res = await fetch(`${baseUrl}/healthz`, { signal: controller.signal });
      if (res.ok) return;
    } catch {
      // server not ready yet
    } finally {
      clearTimeout(timeout);
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error(`Packaged API did not become ready within ${timeoutMs}ms`);
};

const startPackagedServe = async (tempRoot: string) => {
  let startupError: unknown = null;
  const firstPort = createCandidatePort();

  for (let attempt = 1; attempt <= 8; attempt += 1) {
    const port = firstPort + attempt - 1;
    const baseUrl = `http://localhost:${port}`;
    const storagePath = join(tempRoot, "storage");
    const dbPath = join(tempRoot, "db.sqlite");
    const child = spawn(BINARY_PATH, ["serve", "--port", String(port)], {
      // Run outside the repo root so runtime file access cannot rely on local workspace paths.
      cwd: tempRoot,
      env: {
        ...process.env,
        PORT: String(port),
        PSTDIO_API_PORT: String(port),
        PSTDIO_DB_PATH: dbPath,
        PSTDIO_STORAGE_PATH: storagePath,
        PSTDIO_AGENTS: "fake",
      },
      stdio: "pipe",
    });

    let stderr = "";
    const collectStderr = (chunk: Buffer | string) => {
      stderr += chunk.toString();
    };
    child.stderr?.on("data", collectStderr);

    try {
      await waitForReady(baseUrl);
      return { child, baseUrl };
    } catch (error) {
      startupError = new Error(
        `startup attempt ${attempt} failed: ${error instanceof Error ? error.message : String(error)}\n${stderr}`.trim(),
      );

      if (child.exitCode === null && child.signalCode === null) {
        child.kill();
        await new Promise((resolve) => child.once("exit", resolve));
      }
      child.stderr?.off("data", collectStderr);
    }
  }

  throw startupError instanceof Error ? startupError : new Error(String(startupError));
};

const stopProcess = async (child: ChildProcess) => {
  if (child.exitCode === null && child.signalCode === null) {
    child.kill();
    await new Promise((resolve) => child.once("exit", resolve));
  }
};

beforeAll(() => {
  buildBinary();
}, BUILD_TIMEOUT);

describe("packaged pstdio — self-hosted serve", () => {
  test(
    "creates project with bundled templates and repo bootstrap artifacts",
    async () => {
      const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-packaged-serve-"));
      let child: ChildProcess | null = null;

      try {
        const started = await startPackagedServe(tempRoot);
        child = started.child;

        const createRes = await fetch(`${started.baseUrl}/v1/projects`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: "packaged-serve-project" }),
        });
        expect(createRes.status).toBe(201);

        const project = (await createRes.json()) as { id: string };
        const templatesRes = await fetch(`${started.baseUrl}/v1/projects/${project.id}/templates`);
        expect(templatesRes.status).toBe(200);

        const templates = (await templatesRes.json()) as { name: string }[];
        const templateNames = templates.map((template) => template.name).sort();
        expect(templateNames).toEqual(REQUIRED_TEMPLATE_NAMES);

        const skillsRes = await fetch(`${started.baseUrl}/v1/projects/${project.id}/skills`);
        expect(skillsRes.status).toBe(200);

        const skills = (await skillsRes.json()) as { name: string }[];
        const skillNames = skills.map((skill) => skill.name).sort();
        expect(skillNames).toEqual(REQUIRED_SKILL_NAMES);

        const repoPath = join(tempRoot, "repo");
        mkdirSync(repoPath, { recursive: true });

        const repoRes = await fetch(`${started.baseUrl}/v1/projects/${project.id}/repos`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: "repo", path: repoPath }),
        });
        expect(repoRes.status).toBe(201);

        expect(existsSync(join(repoPath, ".pstdio", "config.json"))).toBe(true);
        expect(existsSync(join(repoPath, ".pstdio", "docs", "index.md"))).toBe(true);
        expect(existsSync(join(repoPath, ".pstdio", "docs", "navigation.json"))).toBe(true);
        for (const hookName of REQUIRED_HOOK_NAMES) {
          expect(existsSync(join(repoPath, ".pstdio", "hooks", hookName))).toBe(true);
        }
      } finally {
        if (child) {
          await stopProcess(child);
        }
        rmSync(tempRoot, { recursive: true, force: true });
      }
    },
    SMOKE_TEST_TIMEOUT,
  );
});
