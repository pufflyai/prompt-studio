import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { execSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { createApp } from "../../../app";
import type { AppBindings } from "../../../types";

let app: OpenAPIHono<AppBindings>;
let appHandle: Awaited<ReturnType<typeof createApp>>;
let tempRoot: string;
let projectId: string;

let previousPstdioHomeEnv: string | undefined;
let previousDefaultExtensionsEnv: string | undefined;

const createGitRepo = (name: string) => {
  const repoRoot = join(tempRoot, name);
  mkdirSync(repoRoot, { recursive: true });
  execSync("git init", { cwd: repoRoot, stdio: "pipe" });
  execSync('git config user.email "test@test.com"', { cwd: repoRoot, stdio: "pipe" });
  execSync('git config user.name "Test"', { cwd: repoRoot, stdio: "pipe" });
  writeFileSync(join(repoRoot, "README.md"), "# test\n");
  execSync("git add README.md", { cwd: repoRoot, stdio: "pipe" });
  execSync('git commit -m "init"', { cwd: repoRoot, stdio: "pipe" });
  return repoRoot;
};

const registerRepo = async (repoRoot: string) => {
  const res = await app.request(`/v1/projects/${projectId}/repos`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "repo", path: repoRoot }),
  });
  return res.json();
};

const createWorkspace = async () => {
  const res = await app.request("/v1/workspaces", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ project_id: projectId }),
  });
  return res.json();
};

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-update-workspace-test-"));
  previousPstdioHomeEnv = process.env.PSTDIO_HOME;
  previousDefaultExtensionsEnv = process.env.PSTDIO_DEFAULT_EXTENSIONS;
  process.env.PSTDIO_HOME = join(tempRoot, "pstdio-home");
  process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
  appHandle = await createApp({ dbPath: ":memory:", storagePath: join(tempRoot, "storage"), filesRoot: "" });
  app = appHandle.app;

  const projectRes = await app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "update-workspace-project" }),
  });
  const project = await projectRes.json();
  projectId = project.id;

  const repoRoot = createGitRepo("update-workspace-repo");
  await registerRepo(repoRoot);
});

afterAll(async () => {
  await appHandle.close();
  if (previousPstdioHomeEnv === undefined) delete process.env.PSTDIO_HOME;
  else process.env.PSTDIO_HOME = previousPstdioHomeEnv;
  if (previousDefaultExtensionsEnv === undefined) delete process.env.PSTDIO_DEFAULT_EXTENSIONS;
  else process.env.PSTDIO_DEFAULT_EXTENSIONS = previousDefaultExtensionsEnv;
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("PATCH /v1/workspaces/:id", () => {
  test("renames a workspace", async () => {
    const workspace = await createWorkspace();

    const res = await app.request(`/v1/workspaces/${workspace.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Renamed workspace" }),
    });

    expect(res.status).toBe(200);
    const updated = await res.json();
    expect(updated.name).toBe("Renamed workspace");

    const listRes = await app.request(`/v1/workspaces?project_id=${projectId}`);
    const workspaces = await listRes.json();
    expect(workspaces.find((item: { id: string }) => item.id === workspace.id)?.name).toBe("Renamed workspace");
  });
});
