import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { createApp } from "../../../app";
import { resolveTestFilesRoot } from "../../../test-utils/resolve-test-files-root";
import type { AppBindings } from "../../../types";

let app: OpenAPIHono<AppBindings>;
let tempRoot: string;

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-register-repo-test-"));
  ({ app } = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
    filesRoot: resolveTestFilesRoot(),
  }));
});

afterAll(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

const createProject = async (name: string) => {
  const response = await app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name }),
  });

  return response.json();
};

const registerRepo = (projectId: string, name: string, path: string, extraBody?: Record<string, unknown>) =>
  app.request(`/v1/projects/${projectId}/repos`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, path, ...extraBody }),
  });

describe("POST /v1/projects/:id/repos - basic behavior", () => {
  test("registers a repo and links it to the project", async () => {
    const project = await createProject("Test Project");

    const repoPath = join(tempRoot, "my-repo");
    mkdirSync(repoPath, { recursive: true });

    const res = await registerRepo(project.id, "my-repo", repoPath);

    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.id).toBeDefined();
    expect(body.name).toBe("my-repo");
    expect(body.path).toBe(repoPath);
  });

  test("returns 404 for non-existent project", async () => {
    const res = await app.request("/v1/projects/nonexistent/repos", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "my-repo", path: "/home/user/my-repo" }),
    });

    expect(res.status).toBe(404);
  });

  test("returns 400 when body contains unknown keys", async () => {
    const project = await createProject("Strict Repo Project");

    const repoPath = join(tempRoot, "strict-repo");
    mkdirSync(repoPath, { recursive: true });

    const res = await registerRepo(project.id, "strict-repo", repoPath, { unknown_key: "value" });

    expect(res.status).toBe(400);
  });
});

describe("POST /v1/projects/:id/repos - repo bootstrap", () => {
  test("writes .pstdio/config.json with project_id", async () => {
    const project = await createProject("Config Project");

    const repoPath = join(tempRoot, "config-repo");
    mkdirSync(repoPath, { recursive: true });

    const res = await registerRepo(project.id, "config-repo", repoPath);

    expect(res.status).toBe(201);

    const configPath = join(repoPath, ".pstdio", "config.json");
    expect(existsSync(configPath)).toBe(true);

    const config = JSON.parse(readFileSync(configPath, "utf8"));
    expect(config.project_id).toBe(project.id);
  });

  test("scaffolds the default starter plugins", async () => {
    const project = await createProject("Hook Project");

    const repoPath = join(tempRoot, "hook-repo");
    mkdirSync(repoPath, { recursive: true });

    const res = await registerRepo(project.id, "hook-repo", repoPath);

    expect(res.status).toBe(201);

    const pluginDir = join(repoPath, ".pstdio", "plugins");
    expect(existsSync(pluginDir)).toBe(true);
    expect(readdirSync(pluginDir).sort()).toEqual([
      "code-review-lifecycle.ts",
      "scheduled-heartbeat.ts",
      "ticket-actions.ts",
      "ticket-lifecycle.ts",
      "workspace-actions.ts",
      "worktree-lifecycle.ts",
    ]);
  });

  test("overrides stale config when the linked project no longer exists and clears local tickets", async () => {
    const project = await createProject("Relink Target");

    const repoPath = join(tempRoot, "stale-config-repo");
    const stalePstdioDir = join(repoPath, ".pstdio");
    const staleTicketsDir = join(stalePstdioDir, "tickets", "PS-1_stale-ticket");
    const staleConfigPath = join(stalePstdioDir, "config.json");

    mkdirSync(staleTicketsDir, { recursive: true });
    writeFileSync(staleConfigPath, `${JSON.stringify({ project_id: "missing-project-id" }, null, 2)}\n`);
    writeFileSync(join(staleTicketsDir, "ticket.md"), "# stale ticket\n");

    const res = await registerRepo(project.id, "stale-config-repo", repoPath);

    expect(res.status).toBe(201);
    expect(existsSync(join(repoPath, ".pstdio", "tickets"))).toBe(false);

    const config = JSON.parse(readFileSync(staleConfigPath, "utf8"));
    expect(config.project_id).toBe(project.id);
  });
});

describe("POST /v1/projects/:id/repos - conflicts and idempotency", () => {
  test("returns 409 when repo is already linked to a different project", async () => {
    const projectA = await createProject("Project A");
    const projectB = await createProject("Project B");

    const repoPath = join(tempRoot, "conflict-repo");
    mkdirSync(repoPath, { recursive: true });

    const first = await registerRepo(projectA.id, "conflict-repo", repoPath);
    expect(first.status).toBe(201);

    const second = await registerRepo(projectB.id, "conflict-repo", repoPath);
    expect(second.status).toBe(409);

    const body = await second.json();
    expect(body.error).toContain("already linked");
  });

  test("is idempotent for same repo path", async () => {
    const project = await createProject("Idempotent Test");

    const repoPath = join(tempRoot, "same-repo");
    mkdirSync(repoPath, { recursive: true });

    const first = await registerRepo(project.id, "my-repo", repoPath);
    const firstBody = await first.json();

    const second = await registerRepo(project.id, "my-repo", repoPath);
    const secondBody = await second.json();

    expect(secondBody.id).toBe(firstBody.id);
  });
});
