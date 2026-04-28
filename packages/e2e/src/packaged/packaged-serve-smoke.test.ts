import { beforeAll, describe, expect, test } from "bun:test";
import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildBinary } from "./packaged-helpers";

const BUILD_TIMEOUT = 180_000;
const SMOKE_TEST_TIMEOUT = 30_000;
const REPO_ROOT = join(import.meta.dirname, "../../../..");
const BINARY_PATH = join(REPO_ROOT, "dist/pstdio");
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

const waitForActionKeys = async (
  baseUrl: string,
  projectId: string,
  expectedKeys: string[],
  targetType: "workspace",
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

const writeWorkspaceActionExtension = (
  repoPath: string,
  extensionDirName: string,
  extensionId: string,
  commandKey: string,
) => {
  const extensionDir = join(repoPath, ".pstdio", "extensions", extensionDirName);
  mkdirSync(extensionDir, { recursive: true });
  writeFileSync(
    join(extensionDir, "extension.ts"),
    [
      "export default {",
      `  id: ${JSON.stringify(extensionId)},`,
      `  name: ${JSON.stringify(extensionId)},`,
      "  commands: {",
      `    ${commandKey}: {`,
      `      title: ${JSON.stringify(commandKey)},`,
      '      target: "workspace",',
      '      menus: [{ slot: "workspace.header.secondary" }],',
      "      async run() {},",
      "    },",
      "  },",
      "};",
      "",
    ].join("\n"),
    "utf8",
  );
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

const expectPlannerTicketCommandStorage = async (baseUrl: string, projectId: string) => {
  const createPlannerTicketRes = await fetch(
    `${baseUrl}/v1/projects/${projectId}/extension-commands/pstdio.planner.createTicket/execute`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        params: {
          shorthand: "PS-1",
          title: "Packaged planner ticket",
          content: "# Packaged planner ticket\n\nCreated through the packaged planner command.",
        },
      }),
    },
  );
  expect(createPlannerTicketRes.status).toBe(200);

  const plannerTicketsRes = await fetch(
    `${baseUrl}/v1/projects/${projectId}/extensions/pstdio.planner/collections/tickets`,
  );
  expect(plannerTicketsRes.status).toBe(200);
  const plannerTickets = (await plannerTicketsRes.json()) as {
    items: { item_id: string; value_json: { shorthand?: string; displayTitle?: string | null } }[];
  };
  expect(plannerTickets.items).toContainEqual(
    expect.objectContaining({
      item_id: "PS-1",
      value_json: expect.objectContaining({
        shorthand: "PS-1",
        displayTitle: "Packaged planner ticket",
      }),
    }),
  );
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
        expect(templates.length).toBeGreaterThan(0);

        const skillsRes = await fetch(`${started.baseUrl}/v1/projects/${project.id}/skills`);
        expect(skillsRes.status).toBe(200);

        const skills = (await skillsRes.json()) as {
          name: string;
          files: { path: string; content: string; encoding: "utf8" }[];
        }[];
        expect(skills.length).toBeGreaterThan(0);
        const multiFileSkill = skills.find((skill) => skill.files.length > 1);
        expect(multiFileSkill).toBeDefined();

        const harnessInfoRes = await fetch(`${started.baseUrl}/v1/harnesses/info`);
        expect(harnessInfoRes.status).toBe(200);

        const harnessInfo = (await harnessInfoRes.json()) as { id: string }[];
        expect(harnessInfo.map((harness) => harness.id).sort()).toEqual([
          "pstdio.harness.claude-code",
          "pstdio.harness.fake",
          "pstdio.harness.opencode",
        ]);

        const repoPath = join(tempRoot, "repo");
        mkdirSync(repoPath, { recursive: true });

        const repoRes = await fetch(`${started.baseUrl}/v1/projects/${project.id}/repos`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: "repo", path: repoPath }),
        });
        expect(repoRes.status).toBe(201);

        expect(existsSync(join(repoPath, ".pstdio", "config.json"))).toBe(true);

        await expectPlannerTicketCommandStorage(started.baseUrl, project.id);

        writeWorkspaceActionExtension(repoPath, "workspace-actions", "project.workspace-actions", "runReview");
        const workspaceActionKeys = await waitForActionKeys(
          started.baseUrl,
          project.id,
          ["project.workspace-actions.runReview"],
          "workspace",
        );
        expect(workspaceActionKeys.sort()).toEqual(["project.workspace-actions.runReview"]);
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
    "loads project extension command actions after packaged server restart",
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

        writeWorkspaceActionExtension(repoPath, "restart-actions", "project.restart-actions", "review");

        await stopProcess(child);
        child = null;

        started = await startPackagedServe(tempRoot);
        child = started.child;

        const projectsRes = await fetch(`${started.baseUrl}/v1/projects`);
        expect(projectsRes.status).toBe(200);

        const actionKeys = await waitForActionKeys(
          started.baseUrl,
          project.id,
          ["project.restart-actions.review"],
          "workspace",
        );
        expect(actionKeys).toContain("project.restart-actions.review");
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
    "loads custom project extension actions in packaged mode",
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

        writeWorkspaceActionExtension(repoPath, "project-alpha", "project.alpha-actions", "reviewAlpha");
        writeWorkspaceActionExtension(repoPath, "project-beta", "project.beta-actions", "reviewBeta");

        const actionKeys = await waitForActionKeys(
          started.baseUrl,
          project.id,
          ["project.alpha-actions.reviewAlpha", "project.beta-actions.reviewBeta"],
          "workspace",
        );

        expect(actionKeys).toContain("project.alpha-actions.reviewAlpha");
        expect(actionKeys).toContain("project.beta-actions.reviewBeta");
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
