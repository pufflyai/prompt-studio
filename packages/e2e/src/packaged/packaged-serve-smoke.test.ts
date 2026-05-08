import { beforeAll, describe, expect, test } from "bun:test";
import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildBinary } from "./packaged-helpers";

const BUILD_TIMEOUT = 180_000;
const SMOKE_TEST_TIMEOUT = 30_000;
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

const waitForFile = async (filePath: string, timeoutMs = 10_000) => {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (existsSync(filePath)) return;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error(`Expected file to exist within ${timeoutMs}ms: ${filePath}`);
};

const waitForActionKeys = async (
  baseUrl: string,
  projectId: string,
  expectedKeys: string[],
  targetType: "ticket" | "workspace" = "ticket",
  timeoutMs = 10_000,
) => {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const res = await fetch(`${baseUrl}/v1/projects/${projectId}/actions?targetType=${targetType}`);
    if (res.ok) {
      const actions = (await res.json()) as { key: string }[];
      const keys = actions.map((action) => action.key);

      if (expectedKeys.every((key) => keys.includes(key))) {
        return keys;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error(`Expected actions to be available within ${timeoutMs}ms: ${expectedKeys.join(", ")}`);
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
        HOME: tempRoot,
        PORT: String(port),
        PSTDIO_API_PORT: String(port),
        PSTDIO_DB_PATH: dbPath,
        PSTDIO_DEFAULT_EXTENSIONS: "[]",
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
        const pluginsDir = join(repoPath, ".pstdio", "plugins");
        expect(existsSync(pluginsDir)).toBe(true);
        expect(readdirSync(pluginsDir).length).toBeGreaterThan(0);

        const actionKeys = await waitForActionKeys(started.baseUrl, project.id, ["ticket-actions/run-attempt"]);
        expect(actionKeys).toContain("ticket-actions/run-attempt");

        const workspaceActionKeys = await waitForActionKeys(
          started.baseUrl,
          project.id,
          ["workspace-actions/run-review"],
          "workspace",
        );
        expect(workspaceActionKeys.sort()).toEqual(["workspace-actions/run-review"]);
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
    "restores starter plugins for already-linked repos on packaged server restart",
    async () => {
      const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-packaged-serve-restart-"));
      let child: ChildProcess | null = null;

      try {
        let started = await startPackagedServe(tempRoot);
        child = started.child;

        const createRes = await fetch(`${started.baseUrl}/v1/projects`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: "packaged-serve-restart-project" }),
        });
        expect(createRes.status).toBe(201);

        const project = (await createRes.json()) as { id: string };
        const repoPath = join(tempRoot, "restart-repo");
        mkdirSync(repoPath, { recursive: true });

        const repoRes = await fetch(`${started.baseUrl}/v1/projects/${project.id}/repos`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: "restart-repo", path: repoPath }),
        });
        expect(repoRes.status).toBe(201);

        const pluginsDir = join(repoPath, ".pstdio", "plugins");
        const ticketActionsPath = join(pluginsDir, "ticket-actions.ts");
        rmSync(pluginsDir, { recursive: true, force: true });
        expect(existsSync(ticketActionsPath)).toBe(false);

        await stopProcess(child);
        child = null;

        started = await startPackagedServe(tempRoot);
        child = started.child;

        const projectsRes = await fetch(`${started.baseUrl}/v1/projects`);
        expect(projectsRes.status).toBe(200);

        await waitForFile(ticketActionsPath);
        expect(readdirSync(pluginsDir).length).toBeGreaterThan(0);
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
    "loads custom TypeScript and JavaScript project plugins in packaged mode",
    async () => {
      const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-packaged-serve-project-plugins-"));
      let child: ChildProcess | null = null;

      try {
        const started = await startPackagedServe(tempRoot);
        child = started.child;

        const createRes = await fetch(`${started.baseUrl}/v1/projects`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: "packaged-serve-project-plugins" }),
        });
        expect(createRes.status).toBe(201);

        const project = (await createRes.json()) as { id: string };
        const repoPath = join(tempRoot, "project-plugins-repo");
        mkdirSync(repoPath, { recursive: true });

        const repoRes = await fetch(`${started.baseUrl}/v1/projects/${project.id}/repos`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: "project-plugins-repo", path: repoPath }),
        });
        expect(repoRes.status).toBe(201);

        const pluginsDir = join(repoPath, ".pstdio", "plugins");
        writeFileSync(
          join(pluginsDir, "project-ts.ts"),
          [
            'import { definePlugin } from "@pstdio/sdk/plugins";',
            "",
            "export default definePlugin({",
            "  actions: [",
            "    {",
            '      key: "ts-action",',
            '      label: "TS action",',
            '      targetType: "ticket",',
            '      placement: "primary",',
            "      async trigger() {},",
            "    },",
            "  ],",
            "});",
            "",
          ].join("\n"),
          "utf8",
        );
        writeFileSync(
          join(pluginsDir, "project-js.js"),
          [
            "export default {",
            "  actions: [",
            "    {",
            '      key: "js-action",',
            '      label: "JS action",',
            '      targetType: "ticket",',
            '      placement: "secondary",',
            "      async trigger() {},",
            "    },",
            "  ],",
            "};",
            "",
          ].join("\n"),
          "utf8",
        );

        const actionKeys = await waitForActionKeys(started.baseUrl, project.id, [
          "ticket-actions/run-attempt",
          "project-ts/ts-action",
          "project-js/js-action",
        ]);

        expect(actionKeys).toContain("ticket-actions/run-attempt");
        expect(actionKeys).toContain("project-ts/ts-action");
        expect(actionKeys).toContain("project-js/js-action");
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
