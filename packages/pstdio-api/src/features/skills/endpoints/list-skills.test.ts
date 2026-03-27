import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { getBundledSkills } from "pstdio-agents";
import { createApp } from "../../../app";
import type { AppBindings } from "../../../types";

let app: OpenAPIHono<AppBindings>;
let tempRoot: string;
let projectId: string;
let bundledSkills: Awaited<ReturnType<typeof getBundledSkills>>;

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-skills-test-"));
  ({ app } = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
  }));
  bundledSkills = await getBundledSkills();

  const res = await app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Test Project" }),
  });
  const project = await res.json();
  projectId = project.id;
});

afterAll(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("GET /v1/projects/:id/skills", () => {
  test("lists all bundled skills seeded on project creation", async () => {
    const res = await app.request(`/v1/projects/${projectId}/skills`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveLength(bundledSkills.length);

    const names = body.map((s: { name: string }) => s.name).sort();
    const expectedNames = bundledSkills.map((s) => s.name).sort();
    expect(names).toEqual(expectedNames);
  });
});

describe("GET /v1/projects/:id/skills/:name", () => {
  test("returns skill with content and bundled_version", async () => {
    const skill = bundledSkills[0];
    const res = await app.request(`/v1/projects/${projectId}/skills/${skill.name}`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.name).toBe(skill.name);
    expect(body.content).toBe(skill.content);
    expect(body.bundled_version).toBe(skill.version);
  });

  test("returns 404 for missing skill", async () => {
    const res = await app.request(`/v1/projects/${projectId}/skills/nonexistent`);
    expect(res.status).toBe(404);
  });
});

describe("POST /v1/projects/:id/skills/:name/update", () => {
  test("updates skill content from bundled version", async () => {
    const skill = bundledSkills[0];

    const res = await app.request(`/v1/projects/${projectId}/skills/${skill.name}/update`, {
      method: "POST",
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.name).toBe(skill.name);
    expect(body.content).toBe(skill.content);
  });

  test("returns 404 for missing skill", async () => {
    const res = await app.request(`/v1/projects/${projectId}/skills/nonexistent/update`, {
      method: "POST",
    });
    expect(res.status).toBe(404);
  });
});

describe("skill seeding idempotency", () => {
  test("creating a second project also seeds skills", async () => {
    const res = await app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Second Project" }),
    });
    const project = await res.json();

    const listRes = await app.request(`/v1/projects/${project.id}/skills`);
    const skills = await listRes.json();
    expect(skills).toHaveLength(bundledSkills.length);
  });
});
