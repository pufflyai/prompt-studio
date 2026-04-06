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

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-exec-action-"));
  const repoPath = join(tempRoot, "repo");
  const pluginsDir = join(repoPath, ".pstdio", "plugins");
  mkdirSync(pluginsDir, { recursive: true });

  writeFileSync(
    join(pluginsDir, "test-actions.ts"),
    `export default {
      actions: [
        {
          key: "noop",
          label: "No-op",
          targetType: "ticket",
          placement: "primary",
          async trigger() {},
        },
        {
          key: "with-params",
          label: "With params",
          targetType: "ticket",
          placement: "overflow",
          params: [
            { key: "name", label: "Name", type: "text" },
            { key: "agent", label: "Agent", type: "agent" },
          ],
          async trigger() {},
        },
      ],
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
});

afterAll(async () => {
  await close();
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("POST /v1/projects/:projectId/actions/:actionKey/execute", () => {
  test("executes a registered action", async () => {
    // Create a ticket as the target
    const ticketRes = await app.request("/v1/tickets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ project_id: projectId, user_prompt: "test" }),
    });
    const ticket = await ticketRes.json();

    const res = await app.request(`/v1/projects/${projectId}/actions/test-actions%2Fnoop/execute`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ target_type: "ticket", target_id: ticket.id }),
    });

    expect(res.status).toBe(200);
    const result = await res.json();
    expect(result.status).toBe("success");
  });

  test("executes an action with params", async () => {
    const ticketRes = await app.request("/v1/tickets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ project_id: projectId, user_prompt: "test params" }),
    });
    const ticket = await ticketRes.json();

    const res = await app.request(`/v1/projects/${projectId}/actions/test-actions%2Fwith-params/execute`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        target_type: "ticket",
        target_id: ticket.id,
        params: {
          name: "hello",
          agent: { agent: "claude-code", model: "opus" },
        },
      }),
    });

    expect(res.status).toBe(200);
    const result = await res.json();
    expect(result.status).toBe("success");
  });

  test("returns 404 for unknown action key", async () => {
    const res = await app.request(`/v1/projects/${projectId}/actions/unknown%2Faction/execute`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ target_type: "ticket", target_id: "some-id" }),
    });

    expect(res.status).toBe(404);
  });
});
