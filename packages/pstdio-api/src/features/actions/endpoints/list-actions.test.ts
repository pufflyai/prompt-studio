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

const writeExtension = (repoPath: string, extensionId: string, source: string) => {
  const extensionDir = join(repoPath, ".pstdio", "extensions", extensionId);
  mkdirSync(extensionDir, { recursive: true });
  writeFileSync(join(extensionDir, "extension.ts"), source);
};

const writePlugin = (repoPath: string, fileName: string, source: string) => {
  const pluginsDir = join(repoPath, ".pstdio", "plugins");
  mkdirSync(pluginsDir, { recursive: true });
  writeFileSync(join(pluginsDir, fileName), source);
};

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
  test("returns empty array when no extension commands have menus", async () => {
    const res = await app.request(`/v1/projects/${projectId}/actions`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  test("returns actions from extension command menus", async () => {
    const tempRoot2 = mkdtempSync(join(tmpdir(), "pstdio-api-actions-test2-"));
    const repoPath2 = join(tempRoot2, "repo");
    writeExtension(
      repoPath2,
      "project-actions",
      `export default {
        id: "project.actions",
        name: "Project Actions",
        commands: {
          doThing: {
            title: "Do thing",
            target: "ticket",
            menus: [{ slot: "ticket.header.primary" }],
            run() {},
          },
        },
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
      key: "project.actions.doThing",
      label: "Do thing",
      targetType: "ticket",
      placement: "primary",
    });

    await close2();
    rmSync(tempRoot2, { recursive: true, force: true });
  });

  test("ignores legacy plugin action files", async () => {
    const tempRoot5 = mkdtempSync(join(tmpdir(), "pstdio-api-actions-test5-"));
    const repoPath5 = join(tempRoot5, "repo");
    writePlugin(
      repoPath5,
      "ticket-actions.ts",
      `export default {
        actions: [
          { key: "run-attempt", label: "Run attempt", targetType: "ticket", placement: "primary", trigger() {} },
        ],
      };`,
    );

    const { app: app5, close: close5 } = await createApp({
      dbPath: ":memory:",
      storagePath: join(tempRoot5, "storage"),
      filesRoot: "",
    });

    const projRes = await app5.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Bundled Actions Project" }),
    });
    const proj = await projRes.json();

    await app5.request(`/v1/projects/${proj.id}/repos`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "test-repo", path: repoPath5 }),
    });

    const res = await app5.request(`/v1/projects/${proj.id}/actions?targetType=ticket`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);

    await close5();
    rmSync(tempRoot5, { recursive: true, force: true });
  });

  test("returns no action buttons for first-party commands without menus", async () => {
    const tempRoot6 = mkdtempSync(join(tmpdir(), "pstdio-api-actions-test6-"));

    const { app: app6, close: close6 } = await createApp({
      dbPath: ":memory:",
      storagePath: join(tempRoot6, "storage"),
      filesRoot: "",
    });

    const projRes = await app6.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Bundled Workspace Actions Project" }),
    });
    const proj = await projRes.json();

    const res = await app6.request(`/v1/projects/${proj.id}/actions?targetType=workspace`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);

    await close6();
    rmSync(tempRoot6, { recursive: true, force: true });
  });

  test("filters actions by targetType query param", async () => {
    const tempRoot3 = mkdtempSync(join(tmpdir(), "pstdio-api-actions-test3-"));
    const repoPath3 = join(tempRoot3, "repo");
    writeExtension(
      repoPath3,
      "multi-actions",
      `export default {
        id: "project.multi-actions",
        name: "Multi Actions",
        commands: {
          ticketAction: {
            title: "Ticket action",
            target: "ticket",
            menus: [{ slot: "ticket.header.primary" }],
            run() {},
          },
          workspaceAction: {
            title: "Workspace action",
            target: "workspace",
            menus: [{ slot: "workspace.header.secondary" }],
            run() {},
          },
        },
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
    expect(ticketActions[0].key).toBe("project.multi-actions.ticketAction");

    const wsRes = await app3.request(`/v1/projects/${proj.id}/actions?targetType=workspace`);
    const wsActions = await wsRes.json();
    expect(wsActions).toHaveLength(1);
    expect(wsActions[0].key).toBe("project.multi-actions.workspaceAction");

    await close3();
    rmSync(tempRoot3, { recursive: true, force: true });
  });

  test("returns actions with params schema", async () => {
    const tempRoot4 = mkdtempSync(join(tmpdir(), "pstdio-api-actions-test4-"));
    const repoPath4 = join(tempRoot4, "repo");
    writeExtension(
      repoPath4,
      "param-actions",
      `export default {
        id: "project.param-actions",
        name: "Param Actions",
        commands: {
          withParams: {
            title: "With params",
            target: "ticket",
            menus: [{ slot: "ticket.header.overflow" }],
            params: {
              name: { label: "Name", type: "text" },
              harness: { label: "Harness", type: "harness" },
              template: { label: "Template", type: "template", templateType: "ticket", required: false },
            },
            run() {},
          },
        },
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
      { key: "harness", label: "Harness", type: "agent" },
      { key: "template", label: "Template", type: "template-select", required: false, templateType: "ticket" },
    ]);

    await close4();
    rmSync(tempRoot4, { recursive: true, force: true });
  });
});
