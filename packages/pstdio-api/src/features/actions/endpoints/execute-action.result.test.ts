import { afterAll, beforeAll, describe, expect, test } from "bun:test";
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
let ticketId: string;
let workspaceId: string;

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-exec-action-result-"));
  const repoPath = join(tempRoot, "repo");
  const pluginsDir = join(repoPath, ".pstdio", "plugins");
  mkdirSync(pluginsDir, { recursive: true });
  writeFileSync(
    join(pluginsDir, "result-actions.ts"),
    `export default {
      actions: [
        {
          key: "workspace-review",
          label: "Workspace review",
          targetType: "workspace",
          placement: "secondary",
          async trigger(ctx) {
            if (!ctx.target || ctx.targetType !== "workspace") {
              throw new Error("Missing workspace target");
            }
          },
        },
        {
          key: "start-session",
          label: "Start session",
          targetType: "ticket",
          placement: "overflow",
          async trigger() {
            return { session_id: "session-from-action" };
          },
        },
        {
          key: "start-attempt",
          label: "Start attempt",
          targetType: "ticket",
          placement: "primary",
          async trigger() {
            return { session_id: "session-from-attempt" };
          },
        },
      ],
    };`,
  );

  ({ app, close } = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
    filesRoot: "",
  }));

  const projectRes = await app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Execute Action Result Test" }),
  });
  const project = await projectRes.json();
  projectId = project.id;

  const repoRes = await app.request(`/v1/projects/${projectId}/repos`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "test-repo", path: repoPath }),
  });
  expect(repoRes.ok).toBeTrue();

  const ticketRes = await app.request("/v1/tickets", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ project_id: projectId, user_prompt: "test action target" }),
  });
  const ticket = await ticketRes.json();
  ticketId = ticket.id;

  const workspaceRes = await app.request("/v1/workspaces", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      project_id: projectId,
      ticket_id: ticketId,
      ticket_shorthand: ticket.shorthand,
      worktree_path: join(tempRoot, "workspace-1"),
    }),
  });
  const workspace = await workspaceRes.json();
  workspaceId = workspace.id;
});

afterAll(async () => {
  await close();
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("POST /v1/projects/:projectId/actions/:actionKey/execute result handling", () => {
  test("executes workspace actions with a resolved workspace target", async () => {
    const res = await app.request(`/v1/projects/${projectId}/actions/result-actions%2Fworkspace-review/execute`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ target_type: "workspace", target_id: workspaceId }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "success" });
  });

  test("returns session_id when an action returns a created session", async () => {
    const res = await app.request(`/v1/projects/${projectId}/actions/result-actions%2Fstart-session/execute`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ target_type: "ticket", target_id: ticketId }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "success", session_id: "session-from-action" });
  });

  test("returns session_id from attempt responses that include a session", async () => {
    const res = await app.request(`/v1/projects/${projectId}/actions/result-actions%2Fstart-attempt/execute`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ target_type: "ticket", target_id: ticketId }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "success", session_id: "session-from-attempt" });
  });
});
