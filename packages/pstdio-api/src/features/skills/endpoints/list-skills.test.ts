import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { createApp } from "../../../app";
import type { AppBindings } from "../../../types";

let app: OpenAPIHono<AppBindings>;
let tempRoot: string;

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-skills-test-"));
  app = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
  });
});

afterAll(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("GET /v1/skills", () => {
  test("returns 200 with empty array for global scope when no skills installed", async () => {
    const res = await app.request("/v1/skills?agent_id=claude-code&scope=global");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test("returns 200 with skills for project scope", async () => {
    // Create a project and repo first
    const projectRes = await app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "test-project" }),
    });
    const project = (await projectRes.json()) as { id: string };

    const repoPath = join(tempRoot, "repo");
    mkdirSync(repoPath, { recursive: true });

    await app.request(`/v1/projects/${project.id}/repos`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "test-repo", path: repoPath }),
    });

    // Install a skill in the repo
    const skillDir = join(repoPath, ".claude", "skills", "create-ticket");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, "SKILL.md"), '---\nname: create-ticket\ndescription: "Create a ticket"\n---\n');

    const res = await app.request(`/v1/skills?agent_id=claude-code&scope=project&project_id=${project.id}`);
    expect(res.status).toBe(200);

    const body = (await res.json()) as { name: string; description: string }[];
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe("create-ticket");
    expect(body[0].description).toBe("Create a ticket");
  });
});
