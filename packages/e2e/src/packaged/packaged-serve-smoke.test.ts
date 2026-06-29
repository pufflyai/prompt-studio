import { beforeAll, describe, expect, test } from "bun:test";
import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeExtensionWithDependency } from "./extension-fixtures";
import { buildBinary } from "./packaged-helpers";

const BUILD_TIMEOUT = 180_000;
const SMOKE_TEST_TIMEOUT = 30_000;
// The macOS Intel release runner can spend over a minute extracting and loading all bundled core extensions.
const CORE_EXTENSIONS_SMOKE_TEST_TIMEOUT = 120_000;
const REPO_ROOT = join(import.meta.dirname, "../../../..");
const BINARY_PATH = process.env.PSTDIO_PACKAGED_BINARY_PATH ?? join(REPO_ROOT, "dist/pstdio");
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

const startPackagedServe = async (tempRoot: string, env: Record<string, string> = {}) => {
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
        HOME: tempRoot,
        PORT: String(port),
        PSTDIO_API_PORT: String(port),
        PSTDIO_DB_PATH: dbPath,
        PSTDIO_DEFAULT_EXTENSIONS: "[]",
        PSTDIO_STORAGE_PATH: storagePath,
        ...env,
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
  if (!process.env.PSTDIO_PACKAGED_BINARY_PATH) {
    buildBinary();
  }
}, BUILD_TIMEOUT);

describe("packaged pstdio — self-hosted serve", () => {
  test(
    "creates project without internal catalog seeds and with repo bootstrap artifacts",
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
        expect(templates).toEqual([]);

        const skillsRes = await fetch(`${started.baseUrl}/v1/projects/${project.id}/skills`);
        expect(skillsRes.status).toBe(200);

        const skills = (await skillsRes.json()) as {
          name: string;
          files: { path: string; content: string; encoding: "utf8" }[];
        }[];
        expect(skills).toEqual([]);

        const repoPath = join(tempRoot, "repo");
        mkdirSync(repoPath, { recursive: true });

        const repoRes = await fetch(`${started.baseUrl}/v1/projects/${project.id}/repos`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: "repo", path: repoPath }),
        });
        expect(repoRes.status).toBe(201);

        expect(existsSync(join(repoPath, ".pstdio", "config.json"))).toBe(true);
      } finally {
        if (child) {
          await stopProcess(child);
        }
        rmSync(tempRoot, { recursive: true, force: true });
      }
    },
    SMOKE_TEST_TIMEOUT,
  );

  test(
    "loads a default extension that imports an on-disk node_modules dependency",
    async () => {
      const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-packaged-serve-"));
      let child: ChildProcess | null = null;

      try {
        const extensionSource = writeExtensionWithDependency(tempRoot);
        const started = await startPackagedServe(tempRoot, {
          PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify([
            { source: extensionSource, installName: "dep-ext", skipInstall: true },
          ]),
        });
        child = started.child;

        const createRes = await fetch(`${started.baseUrl}/v1/projects`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: "packaged-extension-project" }),
        });
        expect(createRes.status).toBe(201);

        const project = (await createRes.json()) as { id: string };
        const extensionsRes = await fetch(`${started.baseUrl}/v1/projects/${project.id}/extensions`);
        expect(extensionsRes.status).toBe(200);

        const body = (await extensionsRes.json()) as {
          extensions: Array<{ enabled: boolean; installName: string; name: string }>;
        };
        const extension = body.extensions.find((entry) => entry.installName === "dep-ext");

        expect(extension).toMatchObject({
          enabled: true,
          name: "dep-ext",
        });
      } finally {
        if (child) {
          await stopProcess(child);
        }
        rmSync(tempRoot, { recursive: true, force: true });
      }
    },
    SMOKE_TEST_TIMEOUT,
  );

  test(
    "loads packaged core default extensions",
    async () => {
      const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-packaged-serve-"));
      let child: ChildProcess | null = null;

      try {
        const started = await startPackagedServe(tempRoot, {
          PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify({
            defaultExtensions: [
              "harness-claude-code",
              "harness-codex",
              "harness-open-code",
              "pstdio-base-themes",
              "pstdio-planner",
              "pstdio-skills",
              "pstdio-worktree-setup",
            ],
          }),
        });
        child = started.child;

        const createRes = await fetch(`${started.baseUrl}/v1/projects`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: "packaged-core-extensions-project" }),
        });
        expect(createRes.status).toBe(201);

        const project = (await createRes.json()) as { id: string };
        const extensionsRes = await fetch(`${started.baseUrl}/v1/projects/${project.id}/extensions`);
        expect(extensionsRes.status).toBe(200);

        const body = (await extensionsRes.json()) as {
          extensions: Array<{ enabled: boolean; installName: string; name: string }>;
        };

        expect(body.extensions).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ enabled: true, installName: "harness-claude-code" }),
            expect.objectContaining({ enabled: true, installName: "harness-codex" }),
            expect.objectContaining({ enabled: true, installName: "harness-open-code" }),
            expect.objectContaining({ enabled: true, installName: "pstdio-base-themes" }),
            expect.objectContaining({ enabled: true, installName: "pstdio-planner" }),
            expect.objectContaining({ enabled: true, installName: "pstdio-skills" }),
            expect.objectContaining({ enabled: true, installName: "pstdio-worktree-setup" }),
          ]),
        );

        const runtimeRes = await fetch(`${started.baseUrl}/v1/extensions/runtime.js`);
        expect(runtimeRes.status).toBe(200);

        const runtimeScript = await runtimeRes.text();
        expect(runtimeScript).toContain("notification.action");
        expect(runtimeScript).toContain("notification.resolve");
        expect(runtimeScript).toContain("notification.dismiss");
        expect(runtimeScript).toContain("terminal.session");
      } finally {
        if (child) {
          await stopProcess(child);
        }
        rmSync(tempRoot, { recursive: true, force: true });
      }
    },
    CORE_EXTENSIONS_SMOKE_TEST_TIMEOUT,
  );
});
