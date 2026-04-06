import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { createApp } from "../../../app";
import { resolveTestFilesRoot } from "../../../test-utils/resolve-test-files-root";
import type { AppBindings } from "../../../types";

let app: OpenAPIHono<AppBindings>;
let tempRoot: string;

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-list-repos-test-"));
  ({ app } = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
    filesRoot: resolveTestFilesRoot(),
  }));
});

afterAll(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("GET /v1/projects/:id/repos", () => {
  test("reinstalls starter plugins for already-linked repos when they are missing", async () => {
    const createProjectRes = await app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Existing Repo Project" }),
    });
    const project = await createProjectRes.json();

    const repoPath = join(tempRoot, "existing-repo");
    mkdirSync(repoPath, { recursive: true });

    const registerRes = await app.request(`/v1/projects/${project.id}/repos`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "existing-repo", path: repoPath }),
    });
    expect(registerRes.status).toBe(201);

    const pluginsDir = join(repoPath, ".pstdio", "plugins");
    rmSync(pluginsDir, { recursive: true, force: true });
    expect(existsSync(join(pluginsDir, "ticket-actions.ts"))).toBe(false);

    const listRes = await app.request(`/v1/projects/${project.id}/repos`);

    expect(listRes.status).toBe(200);
    expect(existsSync(pluginsDir)).toBe(true);
    expect(readdirSync(pluginsDir).length).toBeGreaterThan(0);
  });
});
