import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { createApp } from "../../../app";
import type { AppBindings } from "../../../types";

let app: OpenAPIHono<AppBindings>;
let tempRoot: string;

const setupProjectWithDocs = async () => {
  const repoDir = mkdtempSync(join(tempRoot, "repo-"));
  const docsDir = join(repoDir, ".pstdio", "docs");
  mkdirSync(docsDir, { recursive: true });
  writeFileSync(join(docsDir, "index.md"), "# Welcome\nHello world");
  writeFileSync(join(docsDir, "guide.md"), "# Guide\nStep by step");
  writeFileSync(
    join(docsDir, "navigation.json"),
    JSON.stringify({
      sidebar: [
        { text: "Welcome", link: "index" },
        { text: "Guide", link: "guide" },
      ],
    }),
  );

  const createRes = await app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Docs Content Project" }),
  });
  const project = (await createRes.json()) as { id: string };

  const registerRepoRes = await app.request(`/v1/projects/${project.id}/repos`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "test-repo", path: repoDir }),
  });
  expect(registerRepoRes.status).toBe(201);

  return project.id;
};

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-docs-content-test-"));
  ({ app } = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
    filesRoot: "",
  }));
});

afterAll(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("GET /v1/projects/:projectId/docs/content", () => {
  test("returns document content for a valid link", async () => {
    const projectId = await setupProjectWithDocs();

    const res = await app.request(`/v1/projects/${projectId}/docs/content?link=index`);
    expect(res.status).toBe(200);

    const body = (await res.json()) as { link: string; path: string; content: string };
    expect(body.link).toBe("index");
    expect(body.path).toBe("index.md");
    expect(body.content).toContain("# Welcome");
  });

  test("returns different document for different link", async () => {
    const projectId = await setupProjectWithDocs();

    const res = await app.request(`/v1/projects/${projectId}/docs/content?link=guide`);
    expect(res.status).toBe(200);

    const body = (await res.json()) as { link: string; content: string };
    expect(body.content).toContain("# Guide");
  });

  test("returns 404 for non-existent document", async () => {
    const projectId = await setupProjectWithDocs();

    const res = await app.request(`/v1/projects/${projectId}/docs/content?link=nonexistent`);
    expect(res.status).toBe(404);
  });

  test("returns 404 for path traversal attempt", async () => {
    const projectId = await setupProjectWithDocs();

    const res = await app.request(`/v1/projects/${projectId}/docs/content?link=../../../etc/passwd`);
    expect(res.status).toBe(404);
  });
});
