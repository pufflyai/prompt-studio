import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Buffer } from "node:buffer";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { createApp } from "../../../app";
import type { AppBindings } from "../../../types";

let app: OpenAPIHono<AppBindings>;
let appDeps: Awaited<ReturnType<typeof createApp>>["deps"];
let tempRoot: string;
let storagePath: string;

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-remove-project-test-"));
  storagePath = join(tempRoot, "storage");
  const created = await createApp({
    dbPath: ":memory:",
    storagePath,
    filesRoot: "",
  });
  app = created.app;
  appDeps = created.deps;
});

afterAll(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

const createProject = async (name: string) => {
  const res = await app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name }),
  });
  return res.json() as Promise<{ id: string; name: string; shorthand: string }>;
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

    await appDeps.fileService.upload({
      project_id: project.id,
      file_name: "test.txt",
      file_kind: "attachment",
      data: Buffer.from("hello"),
      mime_type: "text/plain",
    });

    const projectDir = join(storagePath, project.id);
    expect(existsSync(projectDir)).toBe(true);

    await app.request(`/v1/projects/${project.id}`, { method: "DELETE" });

    expect(existsSync(projectDir)).toBe(false);
  });

  test("removes worktree directories on disk", async () => {
    const project = await createProject("worktree-cleanup");

    const worktreePath = join(tempRoot, "worktrees", "test-worktree");
    mkdirSync(worktreePath, { recursive: true });
    writeFileSync(join(worktreePath, "dummy.txt"), "content");

    await app.request("/v1/workspaces", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        project_id: project.id,
        name: "WS-CLEANUP",
        anchors: [{ type: "pstdio.planner.ticket", id: "PS-1", label: "PS-1", extensionId: "pstdio.planner" }],
        worktree_path: worktreePath,
      }),
    });

    expect(existsSync(worktreePath)).toBe(true);

    await app.request(`/v1/projects/${project.id}`, { method: "DELETE" });

    expect(existsSync(worktreePath)).toBe(false);
  });
});
