import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { execSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { createApp } from "../../../app";
import type { AppBindings } from "../../../types";

let app: OpenAPIHono<AppBindings>;
let close: () => Promise<void>;
let tempRoot: string;
let projectId: string;
let repoPath: string;
let workspaceId: string;

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-exec-action-"));
  repoPath = join(tempRoot, "repo");
  const extensionDir = join(repoPath, ".pstdio", "extensions", "test-actions");
  mkdirSync(extensionDir, { recursive: true });
  execSync("git init", { cwd: repoPath, stdio: "ignore" });
  execSync('git config user.email "test@test.com"', { cwd: repoPath, stdio: "ignore" });
  execSync('git config user.name "Test"', { cwd: repoPath, stdio: "ignore" });
  writeFileSync(join(repoPath, "README.md"), "execute action test\n");
  execSync("git add README.md", { cwd: repoPath, stdio: "ignore" });
  execSync('git commit -m "init"', { cwd: repoPath, stdio: "ignore" });

  writeFileSync(
    join(extensionDir, "extension.ts"),
    `export default {
      id: "project.test-actions",
      name: "Test Actions",
      commands: {
        noop: {
          title: "No-op",
          target: "workspace",
          menus: [{ slot: "workspace.header.primary" }],
          async run() {},
        },
        withParams: {
          title: "With params",
          target: "workspace",
          menus: [{ slot: "workspace.header.overflow" }],
          params: {
            name: { label: "Name", type: "text" },
            harness: { label: "Harness", type: "harness" },
          },
          async run() {},
        },
        writeStorage: {
          title: "Write storage",
          target: "workspace",
          menus: [{ slot: "workspace.header.primary" }],
          params: {
            name: { label: "Name", type: "text" },
          },
          async run(ctx) {
            await ctx.storage.collection("runs").put(ctx.target.id, {
              name: ctx.params.name,
              target: ctx.target,
            });
          },
        },
        returnsSession: {
          title: "Returns session",
          target: "workspace",
          menus: [{ slot: "workspace.header.primary" }],
          async run() {
            return { session_id: "explicit-session-123" };
          },
        },
        captureTarget: {
          title: "Capture target",
          target: "workspace",
          menus: [{ slot: "workspace.header.primary" }],
          async run(ctx) {
            return {
              session_id: String(ctx.target.metadata?.workspaceShorthand),
            };
          },
        },
      },
    };`,
  );

  ({ app, close } = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
    filesRoot: "",
  }));

  const projRes = await app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Execute Action Test" }),
  });
  const proj = await projRes.json();
  projectId = proj.id;

  await app.request(`/v1/projects/${projectId}/repos`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "test-repo", path: repoPath }),
  });

  const workspaceRes = await app.request("/v1/workspaces", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      project_id: projectId,
      name: "WS-PRIMARY",
      anchors: [{ type: "pstdio.planner.ticket", id: "PS-1", label: "PS-1", extensionId: "pstdio.planner" }],
      worktree_path: repoPath,
    }),
  });
  const workspace = await workspaceRes.json();
  workspaceId = workspace.id;
});

afterAll(async () => {
  await close();
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("POST /v1/projects/:projectId/actions/:actionKey/execute", () => {
  test("executes a registered workspace extension command action", async () => {
    const res = await app.request(`/v1/projects/${projectId}/actions/project.test-actions.noop/execute`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ target_type: "workspace", target_id: workspaceId }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "success" });
  });

  test("executes an action with params", async () => {
    const res = await app.request(`/v1/projects/${projectId}/actions/project.test-actions.withParams/execute`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        target_type: "workspace",
        target_id: workspaceId,
        params: {
          name: "hello",
          harness: { agent: "claude-code", model: "opus" },
        },
      }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "success" });
  });

  test("returns 404 for unknown action key", async () => {
    const res = await app.request(`/v1/projects/${projectId}/actions/project.test-actions.unknown/execute`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ target_type: "workspace", target_id: workspaceId }),
    });

    expect(res.status).toBe(404);
  });

  test("executes actions through the extension command storage context", async () => {
    const res = await app.request(`/v1/projects/${projectId}/actions/project.test-actions.writeStorage/execute`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        target_type: "workspace",
        target_id: workspaceId,
        params: { name: "created-from-action" },
      }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "success" });

    const collectionRes = await app.request(
      `/v1/projects/${projectId}/extensions/project.test-actions/collections/runs`,
    );
    const collection = await collectionRes.json();
    expect(collection.items).toEqual([
      expect.objectContaining({
        item_id: workspaceId,
        value_json: expect.objectContaining({
          name: "created-from-action",
          target: expect.objectContaining({ id: workspaceId, type: "workspace" }),
        }),
      }),
    ]);
  });

  test("returns session_id when action explicitly provides one", async () => {
    const res = await app.request(`/v1/projects/${projectId}/actions/project.test-actions.returnsSession/execute`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ target_type: "workspace", target_id: workspaceId }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "success", session_id: "explicit-session-123" });
  });

  test("resolves workspace target by shorthand and exposes ctx.target.workspace_shorthand", async () => {
    const res = await app.request(`/v1/projects/${projectId}/actions/project.test-actions.captureTarget/execute`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ target_type: "workspace", target_id: "WS-PRIMARY" }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "success", session_id: "WS-PRIMARY" });
  });
});
