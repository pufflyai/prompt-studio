import { afterAll, beforeAll, describe, expect, test } from "bun:test";
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

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-actions-test-"));
  const repoPath = join(tempRoot, "repo");
  mkdirSync(repoPath, { recursive: true });

  ({ app, close } = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
    filesRoot: "",
  }));

  const res = await app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Actions Test Project" }),
  });
  const project = await res.json();
  projectId = project.id;

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

describe("GET /v1/projects/:projectId/actions", () => {
  test("returns empty array when no plugins have actions", async () => {
    const res = await app.request(`/v1/projects/${projectId}/actions`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  test("returns actions from plugins", async () => {
    const tempRoot2 = mkdtempSync(join(tmpdir(), "pstdio-api-actions-test2-"));
    const repoPath2 = join(tempRoot2, "repo");
    const pluginsDir = join(repoPath2, ".pstdio", "plugins");
    mkdirSync(pluginsDir, { recursive: true });
    writeFileSync(
      join(pluginsDir, "my-actions.ts"),
      `export default {
        actions: [
          { key: "do-thing", label: "Do thing", targetType: "ticket", placement: "primary", trigger() {} },
        ],
      };`,
    );

    const { app: app2, close: close2 } = await createApp({
      dbPath: ":memory:",
      storagePath: join(tempRoot2, "storage"),
      filesRoot: "",
    });

    const projRes = await app2.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Actions Plugin Project" }),
    });
    const proj = await projRes.json();

    await app2.request(`/v1/projects/${proj.id}/repos`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "test-repo", path: repoPath2 }),
    });

    const res = await app2.request(`/v1/projects/${proj.id}/actions`);
    expect(res.status).toBe(200);

    const actions = await res.json();
    expect(actions).toHaveLength(1);
    expect(actions[0]).toEqual({
      key: "my-actions/do-thing",
      label: "Do thing",
      targetType: "ticket",
      placement: "primary",
    });

    await close2();
    rmSync(tempRoot2, { recursive: true, force: true });
  });

  test("returns bundled starter ticket actions when project has no linked repo", async () => {
    const tempRoot5 = mkdtempSync(join(tmpdir(), "pstdio-api-actions-test5-"));

    const { app: app5, close: close5 } = await createApp({
      dbPath: ":memory:",
      storagePath: join(tempRoot5, "storage"),
      filesRoot: resolveTestFilesRoot(),
    });

    const projRes = await app5.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Bundled Actions Project" }),
    });
    const proj = await projRes.json();

    const res = await app5.request(`/v1/projects/${proj.id}/actions?targetType=ticket`);
    expect(res.status).toBe(200);

    const actions = (await res.json()) as Array<{ key: string; placement: string }>;
    const actionKeys = actions.map((action) => action.key);

    expect(actionKeys).toContain("ticket-actions/run-attempt");
    expect(actionKeys).toContain("ticket-actions/refine-ticket");
    expect(actionKeys).toContain("ticket-actions/break-into-sub-tickets");
    expect(actions.find((action) => action.key === "ticket-actions/run-attempt")?.placement).toBe("primary");

    await close5();
    rmSync(tempRoot5, { recursive: true, force: true });
  });

  test("returns bundled starter workspace actions when project has no linked repo", async () => {
    const tempRoot6 = mkdtempSync(join(tmpdir(), "pstdio-api-actions-test6-"));

    const { app: app6, close: close6 } = await createApp({
      dbPath: ":memory:",
      storagePath: join(tempRoot6, "storage"),
      filesRoot: resolveTestFilesRoot(),
    });

    const projRes = await app6.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Bundled Workspace Actions Project" }),
    });
    const proj = await projRes.json();

    const res = await app6.request(`/v1/projects/${proj.id}/actions?targetType=workspace`);
    expect(res.status).toBe(200);

    const actions = (await res.json()) as Array<{ key: string }>;
    const actionKeys = actions.map((action) => action.key).sort();

    expect(actionKeys).toEqual(["workspace-actions/open-worktree-in-vscode", "workspace-actions/run-review"]);

    await close6();
    rmSync(tempRoot6, { recursive: true, force: true });
  });

  test("filters actions by targetType query param", async () => {
    const tempRoot3 = mkdtempSync(join(tmpdir(), "pstdio-api-actions-test3-"));
    const repoPath3 = join(tempRoot3, "repo");
    const pluginsDir = join(repoPath3, ".pstdio", "plugins");
    mkdirSync(pluginsDir, { recursive: true });
    writeFileSync(
      join(pluginsDir, "multi-actions.ts"),
      `export default {
        actions: [
          { key: "ticket-action", label: "Ticket action", targetType: "ticket", placement: "primary", trigger() {} },
          { key: "workspace-action", label: "Workspace action", targetType: "workspace", placement: "secondary", trigger() {} },
        ],
      };`,
    );

    const { app: app3, close: close3 } = await createApp({
      dbPath: ":memory:",
      storagePath: join(tempRoot3, "storage"),
      filesRoot: "",
    });

    const projRes = await app3.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Filter Project" }),
    });
    const proj = await projRes.json();

    await app3.request(`/v1/projects/${proj.id}/repos`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "test-repo", path: repoPath3 }),
    });

    const ticketRes = await app3.request(`/v1/projects/${proj.id}/actions?targetType=ticket`);
    const ticketActions = await ticketRes.json();
    expect(ticketActions).toHaveLength(1);
    expect(ticketActions[0].key).toBe("multi-actions/ticket-action");

    const wsRes = await app3.request(`/v1/projects/${proj.id}/actions?targetType=workspace`);
    const wsActions = await wsRes.json();
    expect(wsActions).toHaveLength(1);
    expect(wsActions[0].key).toBe("multi-actions/workspace-action");

    await close3();
    rmSync(tempRoot3, { recursive: true, force: true });
  });

  test("returns actions with params schema", async () => {
    const tempRoot4 = mkdtempSync(join(tmpdir(), "pstdio-api-actions-test4-"));
    const repoPath4 = join(tempRoot4, "repo");
    const pluginsDir = join(repoPath4, ".pstdio", "plugins");
    mkdirSync(pluginsDir, { recursive: true });
    writeFileSync(
      join(pluginsDir, "param-actions.ts"),
      `export default {
        actions: [
          {
            key: "with-params",
            label: "With params",
            targetType: "ticket",
            placement: "overflow",
            params: [
              { key: "name", label: "Name", type: "text" },
              { key: "agent", label: "Agent", type: "agent" },
            ],
            trigger() {},
          },
        ],
      };`,
    );

    const { app: app4, close: close4 } = await createApp({
      dbPath: ":memory:",
      storagePath: join(tempRoot4, "storage"),
      filesRoot: "",
    });

    const projRes = await app4.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Params Project" }),
    });
    const proj = await projRes.json();

    await app4.request(`/v1/projects/${proj.id}/repos`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "test-repo", path: repoPath4 }),
    });

    const res = await app4.request(`/v1/projects/${proj.id}/actions`);
    expect(res.status).toBe(200);

    const actions = await res.json();
    expect(actions).toHaveLength(1);
    expect(actions[0].params).toEqual([
      { key: "name", label: "Name", type: "text" },
      { key: "agent", label: "Agent", type: "agent" },
    ]);

    await close4();
    rmSync(tempRoot4, { recursive: true, force: true });
  });
});
