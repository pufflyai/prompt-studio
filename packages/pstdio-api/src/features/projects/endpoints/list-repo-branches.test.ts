import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { git } from "pstdio-wt";
import { createApp } from "../../../app";
import type { AppBindings } from "../../../types";

setDefaultTimeout(10_000);

let app: OpenAPIHono<AppBindings>;
let closeDb: () => Promise<void>;
let tempRoot: string;
let repoDir: string;
let projectId: string;
let repoId: string;

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-branches-test-"));

  // Create a real git repo
  repoDir = join(tempRoot, "repo");
  await Bun.write(join(repoDir, "README.md"), "# test\n");
  await git(repoDir, ["init", "-b", "main"]);
  await git(repoDir, ["config", "user.email", "test@test.com"]);
  await git(repoDir, ["config", "user.name", "Test"]);
  await git(repoDir, ["add", "."]);
  await git(repoDir, ["commit", "-m", "initial"]);
  await git(repoDir, ["branch", "feature-a"]);

  const result = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
  });
  app = result.app;
  closeDb = result.close;

  // Create a project
  const projectRes = await app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "test-project" }),
  });
  const project = await projectRes.json();
  projectId = project.id;

  // Register the repo
  const repoRes = await app.request(`/v1/projects/${projectId}/repos`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "test-repo", path: repoDir }),
  });
  const repo = await repoRes.json();
  repoId = repo.id;
});

afterAll(async () => {
  await closeDb();
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("GET /v1/repos/:repoId/branches", () => {
  test("returns branches for a valid repo", async () => {
    const res = await app.request(`/v1/repos/${repoId}/branches`);

    expect(res.status).toBe(200);

    const branches = await res.json();
    expect(branches.length).toBeGreaterThanOrEqual(2);

    const main = branches.find((b: { name: string }) => b.name === "main");
    expect(main).toBeDefined();
    expect(main.is_current).toBe(true);
    expect(main.is_remote).toBe(false);

    const feature = branches.find((b: { name: string }) => b.name === "feature-a");
    expect(feature).toBeDefined();
    expect(feature.is_current).toBe(false);
  });

  test("returns 404 for unknown repo", async () => {
    const res = await app.request("/v1/repos/nonexistent/branches");

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Repository not found");
  });
});
