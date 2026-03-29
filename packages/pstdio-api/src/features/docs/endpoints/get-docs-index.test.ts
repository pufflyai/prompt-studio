import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { createApp } from "../../../app";
import type { AppBindings } from "../../../types";

let app: OpenAPIHono<AppBindings>;
let tempRoot: string;
let repoDir: string;

const createProjectWithRepo = async (repoPath: string) => {
  const createRes = await app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Docs Test Project" }),
  });
  const project = (await createRes.json()) as { id: string };

  await app.request(`/v1/projects/${project.id}/repos`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "test-repo", path: repoPath }),
  });

  return project.id;
};

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-docs-index-test-"));
  repoDir = join(tempRoot, "repo");
  ({ app } = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
  }));
});

afterAll(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("GET /v1/projects/:projectId/docs", () => {
  test("returns 404 when no repo is linked", async () => {
    const createRes = await app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "No Repo Project" }),
    });
    const project = (await createRes.json()) as { id: string };

    const res = await app.request(`/v1/projects/${project.id}/docs`);
    expect(res.status).toBe(404);
  });

  test("returns starter docs after repo registration scaffolds them", async () => {
    const emptyRepo = join(tempRoot, "empty-repo");
    mkdirSync(emptyRepo, { recursive: true });
    const projectId = await createProjectWithRepo(emptyRepo);

    const res = await app.request(`/v1/projects/${projectId}/docs`);
    expect(res.status).toBe(200);

    const body = (await res.json()) as { sidebar: { text: string; link?: string }[]; missingLinks: string[] };
    expect(body.sidebar).toEqual([{ text: "Getting Started", link: "/index" }]);
    expect(body.missingLinks).toEqual([]);
  });

  test("returns docs index when navigation.json exists", async () => {
    const docsDir = join(repoDir, ".pstdio", "docs");
    mkdirSync(docsDir, { recursive: true });
    writeFileSync(join(docsDir, "index.md"), "# Welcome\nHello world");
    writeFileSync(join(docsDir, "navigation.json"), JSON.stringify({ sidebar: [{ text: "Welcome", link: "index" }] }));

    const projectId = await createProjectWithRepo(repoDir);

    const res = await app.request(`/v1/projects/${projectId}/docs`);
    expect(res.status).toBe(200);

    const body = (await res.json()) as { sidebar: { text: string; link?: string }[]; missingLinks: string[] };
    expect(body.sidebar).toHaveLength(1);
    expect(body.sidebar[0].text).toBe("Welcome");
    expect(body.sidebar[0].link).toBe("index");
    expect(body.missingLinks).toEqual([]);
  });

  test("returns 200 with missingLinks when sidebar references a missing file", async () => {
    const repo2 = join(tempRoot, "repo-missing-links");
    const docsDir = join(repo2, ".pstdio", "docs");
    mkdirSync(docsDir, { recursive: true });
    writeFileSync(join(docsDir, "index.md"), "# Welcome");
    writeFileSync(
      join(docsDir, "navigation.json"),
      JSON.stringify({
        sidebar: [
          { text: "Welcome", link: "index" },
          { text: "Gone", link: "/missing-page" },
        ],
      }),
    );

    const projectId = await createProjectWithRepo(repo2);

    const res = await app.request(`/v1/projects/${projectId}/docs`);
    expect(res.status).toBe(200);

    const body = (await res.json()) as { sidebar: unknown[]; missingLinks: string[] };
    expect(body.sidebar).toHaveLength(2);
    expect(body.missingLinks).toEqual(["/missing-page"]);
  });

  test("returns sidebar template metadata when present", async () => {
    const repoWithTemplate = join(tempRoot, "repo-with-template");
    const docsDir = join(repoWithTemplate, ".pstdio", "docs");
    mkdirSync(docsDir, { recursive: true });
    writeFileSync(join(docsDir, "releases.md"), "# Releases");
    writeFileSync(
      join(docsDir, "navigation.json"),
      JSON.stringify({
        sidebar: [{ text: "Releases", link: "releases", template: "changelog" }],
      }),
    );

    const projectId = await createProjectWithRepo(repoWithTemplate);

    const res = await app.request(`/v1/projects/${projectId}/docs`);
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      sidebar: Array<{ text: string; link?: string; template?: string }>;
      missingLinks: string[];
    };

    expect(body.sidebar).toEqual([{ text: "Releases", link: "releases", template: "changelog" }]);
    expect(body.missingLinks).toEqual([]);
  });
});
