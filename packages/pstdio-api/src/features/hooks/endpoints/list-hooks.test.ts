import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { execSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { createApp } from "../../../app";
import type { AppBindings } from "../../../types";

let app: OpenAPIHono<AppBindings>;
let tempRoot: string;
let projectId: string;
let repoRoot: string;

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-hooks-test-"));
  ({ app } = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
  }));

  const projectRes = await app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "hooks-test" }),
  });
  const project = await projectRes.json();
  projectId = project.id;

  repoRoot = join(tempRoot, "repo");
  mkdirSync(repoRoot, { recursive: true });
  execSync("git init", { cwd: repoRoot, stdio: "pipe" });
  execSync('git config user.email "test@test.com"', { cwd: repoRoot, stdio: "pipe" });
  execSync('git config user.name "Test"', { cwd: repoRoot, stdio: "pipe" });
  writeFileSync(join(repoRoot, "README.md"), "# test\n");
  execSync("git add . && git commit -m init", { cwd: repoRoot, stdio: "pipe" });

  await app.request(`/v1/projects/${projectId}/repos`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "hooks-test-repo", path: repoRoot }),
  });
});

afterAll(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("GET /v1/projects/:id/hooks", () => {
  test("lists all hooks with the default hooks installed", async () => {
    const res = await app.request(`/v1/projects/${projectId}/hooks`);
    expect(res.status).toBe(200);

    const body = (await res.json()) as Array<{ name: string; content: string | null; blocking: boolean }>;
    // 11 worktree + 5 session + 8 ticket = 24
    expect(body.length).toBe(24);
    const postCreate = body.find((h) => h.name === "post-worktree-create");
    expect(postCreate?.content).toContain("pstdio tickets pull");
    expect(postCreate?.blocking).toBe(true);

    const postSuccess = body.find((h) => h.name === "post-session-success");
    expect(postSuccess?.content).toContain("review-ready");

    const postStart = body.find((h) => h.name === "post-session-start");
    expect(postStart?.content).toContain("wip");

    const scaffolded = new Set(["post-worktree-create", "post-session-success", "post-session-start"]);
    expect(body.filter((h) => !scaffolded.has(h.name)).every((h) => h.content === null)).toBe(true);
  });

  test("returns content for installed hooks", async () => {
    const hooksDir = join(repoRoot, ".pstdio", "hooks");
    mkdirSync(hooksDir, { recursive: true });
    writeFileSync(join(hooksDir, "pre-commit"), "bun run lint");

    const res = await app.request(`/v1/projects/${projectId}/hooks`);
    expect(res.status).toBe(200);

    const body = (await res.json()) as Array<{ name: string; content: string | null; blocking: boolean }>;
    const preCommit = body.find((h) => h.name === "pre-commit");
    expect(preCommit?.content).toBe("bun run lint");
    expect(preCommit?.blocking).toBe(true);

    const postCreate = body.find((h) => h.name === "post-worktree-create");
    expect(postCreate?.content).toContain("pstdio tickets pull");
    expect(postCreate?.blocking).toBe(true);
  });

  test("returns 404 for unknown project", async () => {
    const res = await app.request("/v1/projects/nonexistent/hooks");
    expect(res.status).toBe(404);
  });
});

describe("PUT /v1/projects/:id/hooks/:hookName", () => {
  test("creates a hook file", async () => {
    const res = await app.request(`/v1/projects/${projectId}/hooks/post-worktree-create`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "bun install" }),
    });
    expect(res.status).toBe(204);

    const listRes = await app.request(`/v1/projects/${projectId}/hooks`);
    const hooks = (await listRes.json()) as Array<{ name: string; content: string | null }>;
    const postCreate = hooks.find((h) => h.name === "post-worktree-create");
    expect(postCreate?.content).toBe("bun install");
  });

  test("updates an existing hook", async () => {
    const res = await app.request(`/v1/projects/${projectId}/hooks/post-worktree-create`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "bun install && bun run build" }),
    });
    expect(res.status).toBe(204);

    const listRes = await app.request(`/v1/projects/${projectId}/hooks`);
    const hooks = (await listRes.json()) as Array<{ name: string; content: string | null }>;
    expect(hooks.find((h) => h.name === "post-worktree-create")?.content).toBe("bun install && bun run build");
  });
});

describe("DELETE /v1/projects/:id/hooks/:hookName", () => {
  test("deletes an existing hook", async () => {
    // ensure hook exists first
    await app.request(`/v1/projects/${projectId}/hooks/post-worktree-create`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "echo delete-me" }),
    });

    const res = await app.request(`/v1/projects/${projectId}/hooks/post-worktree-create`, {
      method: "DELETE",
    });
    expect(res.status).toBe(204);

    const listRes = await app.request(`/v1/projects/${projectId}/hooks`);
    const hooks = (await listRes.json()) as Array<{ name: string; content: string | null }>;
    expect(hooks.find((h) => h.name === "post-worktree-create")?.content).toBeNull();
  });

  test("returns 204 even when hook does not exist", async () => {
    const res = await app.request(`/v1/projects/${projectId}/hooks/on-conflict`, {
      method: "DELETE",
    });
    expect(res.status).toBe(204);
  });
});
