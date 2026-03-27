import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { getBundledSkills } from "pstdio-agents";
import { createApp } from "../../../app";
import type { AppBindings } from "../../../types";

let app: OpenAPIHono<AppBindings>;
let tempRoot: string;

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-register-repo-test-"));
  ({ app } = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
  }));
});

afterAll(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("POST /v1/projects/:id/repos", () => {
  test("registers a repo and links it to the project", async () => {
    const createRes = await app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Test Project" }),
    });
    const project = await createRes.json();

    const repoPath = join(tempRoot, "my-repo");
    mkdirSync(repoPath, { recursive: true });

    const res = await app.request(`/v1/projects/${project.id}/repos`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "my-repo", path: repoPath }),
    });

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
    const createRes = await app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Strict Repo Project" }),
    });
    const project = await createRes.json();

    const repoPath = join(tempRoot, "strict-repo");
    mkdirSync(repoPath, { recursive: true });

    const res = await app.request(`/v1/projects/${project.id}/repos`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "strict-repo", path: repoPath, unknown_key: "value" }),
    });

    expect(res.status).toBe(400);
  });

  test("installs bundled skills to repo for configured agents", async () => {
    const createRes = await app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Skill Install Project" }),
    });
    const project = await createRes.json();

    await app.request("/v1/agents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agent_id: "claude-code" }),
    });

    const repoPath = join(tempRoot, "skill-repo");
    mkdirSync(repoPath, { recursive: true });

    const res = await app.request(`/v1/projects/${project.id}/repos`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "skill-repo", path: repoPath }),
    });

    expect(res.status).toBe(201);

    const bundled = await getBundledSkills();
    for (const skill of bundled) {
      const skillPath = join(repoPath, ".claude", "skills", skill.name, "SKILL.md");
      expect(existsSync(skillPath)).toBe(true);
      expect(readFileSync(skillPath, "utf8")).toBe(skill.content);
    }
  });

  test("writes .pstdio/config.json with project_id", async () => {
    const createRes = await app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Config Project" }),
    });
    const project = await createRes.json();

    const repoPath = join(tempRoot, "config-repo");
    mkdirSync(repoPath, { recursive: true });

    const res = await app.request(`/v1/projects/${project.id}/repos`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "config-repo", path: repoPath }),
    });

    expect(res.status).toBe(201);

    const configPath = join(repoPath, ".pstdio", "config.json");
    expect(existsSync(configPath)).toBe(true);

    const config = JSON.parse(readFileSync(configPath, "utf8"));
    expect(config.project_id).toBe(project.id);
  });

  test("scaffolds the default post-worktree-create hook", async () => {
    const createRes = await app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Hook Project" }),
    });
    const project = await createRes.json();

    const repoPath = join(tempRoot, "hook-repo");
    mkdirSync(repoPath, { recursive: true });

    const res = await app.request(`/v1/projects/${project.id}/repos`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "hook-repo", path: repoPath }),
    });

    expect(res.status).toBe(201);

    const hookPath = join(repoPath, ".pstdio", "hooks", "post-worktree-create");
    expect(existsSync(hookPath)).toBe(true);
    expect(readFileSync(hookPath, "utf8")).toContain("pstdio tickets pull");
  });

  test("returns 409 when repo is already linked to a different project", async () => {
    const resA = await app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Project A" }),
    });
    const projectA = await resA.json();

    const resB = await app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Project B" }),
    });
    const projectB = await resB.json();

    const repoPath = join(tempRoot, "conflict-repo");
    mkdirSync(repoPath, { recursive: true });

    const first = await app.request(`/v1/projects/${projectA.id}/repos`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "conflict-repo", path: repoPath }),
    });
    expect(first.status).toBe(201);

    const second = await app.request(`/v1/projects/${projectB.id}/repos`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "conflict-repo", path: repoPath }),
    });
    expect(second.status).toBe(409);

    const body = await second.json();
    expect(body.error).toContain("already linked");
  });

  test("overrides stale config when the linked project no longer exists and clears local tickets", async () => {
    const createRes = await app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Relink Target" }),
    });
    const project = await createRes.json();

    const repoPath = join(tempRoot, "stale-config-repo");
    const stalePstdioDir = join(repoPath, ".pstdio");
    const staleTicketsDir = join(stalePstdioDir, "tickets", "PS-1_stale-ticket");
    const staleConfigPath = join(stalePstdioDir, "config.json");

    mkdirSync(staleTicketsDir, { recursive: true });
    writeFileSync(staleConfigPath, `${JSON.stringify({ project_id: "missing-project-id" }, null, 2)}\n`);
    writeFileSync(join(staleTicketsDir, "ticket.md"), "# stale ticket\n");

    const res = await app.request(`/v1/projects/${project.id}/repos`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "stale-config-repo", path: repoPath }),
    });

    expect(res.status).toBe(201);
    expect(existsSync(join(repoPath, ".pstdio", "tickets"))).toBe(false);

    const config = JSON.parse(readFileSync(staleConfigPath, "utf8"));
    expect(config.project_id).toBe(project.id);
  });

  test("is idempotent for same repo path", async () => {
    const createRes = await app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Idempotent Test" }),
    });
    const project = await createRes.json();

    const repoPath = join(tempRoot, "same-repo");
    mkdirSync(repoPath, { recursive: true });

    const first = await app.request(`/v1/projects/${project.id}/repos`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "my-repo", path: repoPath }),
    });
    const firstBody = await first.json();

    const second = await app.request(`/v1/projects/${project.id}/repos`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "my-repo", path: repoPath }),
    });
    const secondBody = await second.json();

    expect(secondBody.id).toBe(firstBody.id);
  });
});
