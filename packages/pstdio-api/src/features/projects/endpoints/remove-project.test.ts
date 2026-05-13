import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Buffer } from "node:buffer";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { createApp } from "../../../app";
import type { AppBindings } from "../../../types";

let app: OpenAPIHono<AppBindings>;
let handle: Awaited<ReturnType<typeof createApp>>;
let tempRoot: string;
let storagePath: string;

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-remove-project-test-"));
  storagePath = join(tempRoot, "storage");
  handle = await createApp({
    dbPath: ":memory:",
    storagePath,
    filesRoot: "",
  });
  app = handle.app;
});

afterAll(async () => {
  await handle.close();
  rmSync(tempRoot, { recursive: true, force: true });
});

const writeRepoExtension = (root: string) => {
  const extensionRoot = join(root, ".pstdio", "extensions", "worktree");
  mkdirSync(extensionRoot, { recursive: true });
  writeFileSync(
    join(extensionRoot, "package.json"),
    JSON.stringify({
      name: "worktree",
      version: "1.0.0",
      publisher: "pstdio",
      main: "./extension.ts",
      engines: { pstdio: "^1.0.0" },
    }),
  );
  writeFileSync(join(extensionRoot, "extension.ts"), "export default {};");
};

const createProject = async (name: string) => {
  const res = await app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name }),
  });
  return res.json() as Promise<{ id: string; name: string; shorthand: string }>;
};

const createTicket = async (projectId: string) => {
  const res = await app.request("/v1/tickets", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ project_id: projectId, content: "test ticket" }),
  });
  return res.json() as Promise<{ id: string; shorthand: string }>;
};

describe("DELETE /v1/projects/:id", () => {
  test("returns 404 for non-existent project", async () => {
    const res = await app.request("/v1/projects/nonexistent", {
      method: "DELETE",
    });
    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body.error).toBe("Project not found");
  });

  test("hard-deletes an existing project", async () => {
    const project = await createProject("delete-me");

    const res = await app.request(`/v1/projects/${project.id}`, {
      method: "DELETE",
    });
    expect(res.status).toBe(204);

    const getRes = await app.request(`/v1/projects/${project.id}`);
    expect(getRes.status).toBe(404);
  });

  test("hard-deleted project is excluded from list", async () => {
    const project = await createProject("hard-delete-list");

    await app.request(`/v1/projects/${project.id}`, { method: "DELETE" });

    const listRes = await app.request("/v1/projects");
    const projects = (await listRes.json()) as { id: string }[];
    const ids = projects.map((p) => p.id);
    expect(ids).not.toContain(project.id);
  });

  test("returns 404 when deleting an already deleted project", async () => {
    const project = await createProject("double-delete");

    await app.request(`/v1/projects/${project.id}`, { method: "DELETE" });

    const res = await app.request(`/v1/projects/${project.id}`, { method: "DELETE" });
    expect(res.status).toBe(404);
  });

  test("removes project storage directory on disk", async () => {
    const project = await createProject("file-cleanup");
    const ticket = await createTicket(project.id);

    await app.request(`/v1/tickets/${ticket.id}/files`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        file_name: "test.txt",
        content_base64: Buffer.from("hello").toString("base64"),
      }),
    });

    const projectDir = join(storagePath, project.id);
    expect(existsSync(projectDir)).toBe(true);

    await app.request(`/v1/projects/${project.id}`, { method: "DELETE" });

    expect(existsSync(projectDir)).toBe(false);
  });

  test("removes worktree directories on disk", async () => {
    const project = await createProject("worktree-cleanup");
    const ticket = await createTicket(project.id);

    const worktreePath = join(tempRoot, "worktrees", "test-worktree");
    mkdirSync(worktreePath, { recursive: true });
    writeFileSync(join(worktreePath, "dummy.txt"), "content");

    await app.request("/v1/workspaces", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        project_id: project.id,
        ticket_id: ticket.id,
        ticket_shorthand: ticket.shorthand,
        worktree_path: worktreePath,
      }),
    });

    expect(existsSync(worktreePath)).toBe(true);

    await app.request(`/v1/projects/${project.id}`, { method: "DELETE" });

    expect(existsSync(worktreePath)).toBe(false);
  });

  test("marks repo-local extensions uninstalled before deleting the project", async () => {
    const project = await createProject("remove-local-extensions");
    const repoPath = join(tempRoot, "local-extension-repo");
    writeRepoExtension(repoPath);

    const registerRes = await app.request(`/v1/projects/${project.id}/repos`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "repo", path: repoPath }),
    });
    expect(registerRes.status).toBe(201);

    const [installed] = await handle.deps.extensionService.listInstalledSourcesByInstallNamePrefix("local:");
    expect(installed?.status).toBe("loaded");

    const deleteRes = await app.request(`/v1/projects/${project.id}`, { method: "DELETE" });
    expect(deleteRes.status).toBe(204);

    const [removed] = await handle.deps.extensionService.listInstalledSourcesByInstallNamePrefix("local:");
    expect(removed?.id).toBe(installed?.id);
    expect(removed?.status).toBe("uninstalled");
  });
});
