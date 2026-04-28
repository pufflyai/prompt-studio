import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { execSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { createApp } from "../../../app";
import { resolveTestFilesRoot } from "../../../test-utils/resolve-test-files-root";
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
  const pluginsDir = join(repoPath, ".pstdio", "plugins");
  mkdirSync(pluginsDir, { recursive: true });
  execSync("git init", { cwd: repoPath, stdio: "ignore" });
  execSync('git config user.email "test@test.com"', { cwd: repoPath, stdio: "ignore" });
  execSync('git config user.name "Test"', { cwd: repoPath, stdio: "ignore" });
  writeFileSync(join(repoPath, "README.md"), "execute action test\n");
  execSync("git add README.md", { cwd: repoPath, stdio: "ignore" });
  execSync('git commit -m "init"', { cwd: repoPath, stdio: "ignore" });

  writeFileSync(
    join(pluginsDir, "test-actions.ts"),
    `export default {
      actions: [
        {
          key: "noop",
          label: "No-op",
          targetType: "workspace",
          placement: "primary",
          async trigger() {},
        },
        {
          key: "with-params",
          label: "With params",
          targetType: "workspace",
          placement: "overflow",
          params: [
            { key: "name", label: "Name", type: "text" },
            { key: "agent", label: "Agent", type: "agent" },
          ],
          async trigger() {},
        },
        {
          key: "create-workspace",
          label: "Create workspace",
          targetType: "workspace",
          placement: "primary",
          async trigger(ctx) {
            await ctx.client.workspaces.create({
              project_id: ctx.projectId,
              name: String(ctx.params.name ?? "created-from-action"),
            });
          },
        },
        {
          key: "returns-session",
          label: "Returns session",
          targetType: "workspace",
          placement: "primary",
          async trigger() {
            return { session_id: "explicit-session-123" };
          },
        },
        {
          key: "capture-shorthand",
          label: "Capture shorthand",
          targetType: "workspace",
          placement: "primary",
          async trigger(ctx) {
            return { session_id: String(ctx.target.workspace_shorthand) };
          },
        },
      ],
    };`,
  );

  ({ app, close } = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
    filesRoot: resolveTestFilesRoot(),
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
  test("executes a registered workspace action", async () => {
    const res = await app.request(`/v1/projects/${projectId}/actions/test-actions%2Fnoop/execute`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ target_type: "workspace", target_id: workspaceId }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "success" });
  });

  test("executes an action with params", async () => {
    const res = await app.request(`/v1/projects/${projectId}/actions/test-actions%2Fwith-params/execute`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        target_type: "workspace",
        target_id: workspaceId,
        params: {
          name: "hello",
          agent: { agent: "claude-code", model: "opus" },
        },
      }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "success" });
  });

  test("returns 404 for unknown action key", async () => {
    const res = await app.request(`/v1/projects/${projectId}/actions/unknown%2Faction/execute`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ target_type: "workspace", target_id: workspaceId }),
    });

    expect(res.status).toBe(404);
  });

  test("executes actions that call back into the API client", async () => {
    const res = await app.request(`/v1/projects/${projectId}/actions/test-actions%2Fcreate-workspace/execute`, {
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

    const workspacesRes = await app.request(`/v1/workspaces?project_id=${projectId}`);
    const workspaces = await workspacesRes.json();
    expect(
      workspaces.some(
        (workspace: { workspace_shorthand: string }) => workspace.workspace_shorthand === "created-from-action",
      ),
    ).toBe(true);
  });

  test("returns session_id when action explicitly provides one", async () => {
    const res = await app.request(`/v1/projects/${projectId}/actions/test-actions%2Freturns-session/execute`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ target_type: "workspace", target_id: workspaceId }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "success", session_id: "explicit-session-123" });
  });

  test("resolves workspace target by shorthand and exposes ctx.target.workspace_shorthand", async () => {
    const res = await app.request(`/v1/projects/${projectId}/actions/test-actions%2Fcapture-shorthand/execute`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ target_type: "workspace", target_id: "WS-PRIMARY" }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "success", session_id: "WS-PRIMARY" });
  });
});
