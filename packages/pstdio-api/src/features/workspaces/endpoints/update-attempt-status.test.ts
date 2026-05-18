import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { createFakeAgent } from "pstdio-agents";
import { createApp } from "../../../app";
import type { AppBindings } from "../../../types";

let app: OpenAPIHono<AppBindings>;
let appDeps: Awaited<ReturnType<typeof createApp>>["deps"];
let tempRoot: string;
let projectId: string;
let repoDir: string;

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-attempt-status-test-"));
  repoDir = mkdtempSync(join(tmpdir(), "pstdio-attempt-status-repo-"));
  const created = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
    filesRoot: "",
    agents: [createFakeAgent()],
  });
  app = created.app;
  appDeps = created.deps;

  const projectRes = await app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "attempt-status-test" }),
  });
  const project = await projectRes.json();
  projectId = project.id;

  const agentRes = await app.request("/v1/agents", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ agent_id: "fake" }),
  });
  expect(agentRes.status).toBe(201);

  mkdirSync(repoDir, { recursive: true });
  await app.request(`/v1/projects/${projectId}/repos`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "test-repo", path: repoDir }),
  });
});

afterAll(() => {
  rmSync(tempRoot, { recursive: true, force: true });
  rmSync(repoDir, { recursive: true, force: true });
});

const createAttemptStatus = async (name: string) => {
  const res = await app.request(`/v1/projects/${projectId}/attempt-statuses`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, color: "blue" }),
  });
  expect(res.status).toBe(201);
  return (await res.json()) as { id: string; name: string };
};

const writePlugin = (fileName: string, code: string) => {
  const pluginsDir = join(repoDir, ".pstdio", "plugins");
  mkdirSync(pluginsDir, { recursive: true });
  writeFileSync(join(pluginsDir, fileName), code);
};

const writeExtension = async (name: string, source: string) => {
  const extensionRoot = join(tempRoot, name);
  mkdirSync(extensionRoot, { recursive: true });
  writeFileSync(
    join(extensionRoot, "package.json"),
    JSON.stringify({
      name,
      version: "1.0.0",
      publisher: "pstdio",
      main: "./extension.ts",
      engines: { pstdio: "^1.0.0" },
      type: "module",
    }),
  );
  writeFileSync(join(extensionRoot, "extension.ts"), source);

  await appDeps.extensionService.enableInstalledSourceForProject({
    projectId,
    displayName: name,
    extensionId: `pstdio.${name}`,
    installName: name,
    manifest: { name, version: "1.0.0", publisher: "pstdio" },
    name,
    sourceKind: "local_path",
    sourcePath: extensionRoot,
    version: "1.0.0",
  });
};

const createWorkspace = async () => {
  const ticketRes = await app.request("/v1/tickets", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ project_id: projectId, user_prompt: "test" }),
  });
  expect(ticketRes.status).toBe(201);
  const ticket = (await ticketRes.json()) as { id: string; shorthand: string };

  const wsRes = await app.request("/v1/workspaces", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ project_id: projectId, ticket_id: ticket.id, ticket_shorthand: ticket.shorthand }),
  });
  expect(wsRes.status).toBe(201);
  const workspace = (await wsRes.json()) as { id: string; workspace_shorthand: string };
  return { ...workspace, ticket };
};

describe("PATCH /v1/workspaces/:id/attempt-status", () => {
  test("updates attempt status using a default seeded status", async () => {
    const workspace = await createWorkspace();

    const res = await app.request(`/v1/workspaces/${workspace.id}/attempt-status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "review-ready" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.attempt_status_id).toBeTruthy();
    expect(body.to_status).toBe("review-ready");
    expect(body.status_change_id).toBeTruthy();

    const activityRes = await app.request(`/v1/workspaces/${workspace.id}/activity`);
    expect(activityRes.status).toBe(200);
    const activity = (await activityRes.json()) as {
      events: Array<{ event_type: string; payload_json: { to_status?: string } }>;
    };
    expect(activity.events[0].event_type).toBe("workspace_attempt_status_updated");
    expect(activity.events[0].payload_json.to_status).toBe("review-ready");
  });

  test("updates attempt status using a custom status", async () => {
    const status = await createAttemptStatus("qa-passed");
    const workspace = await createWorkspace();

    const res = await app.request(`/v1/workspaces/${workspace.id}/attempt-status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "qa-passed" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.attempt_status_id).toBe(status.id);
    expect(body.to_status).toBe("qa-passed");
    expect(body.from_status).toBeNull();
  });

  test("returns from_status when transitioning between statuses", async () => {
    const workspace = await createWorkspace();

    await app.request(`/v1/workspaces/${workspace.id}/attempt-status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "wip" }),
    });

    const res = await app.request(`/v1/workspaces/${workspace.id}/attempt-status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "review-ready" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.from_status).toBe("wip");
    expect(body.to_status).toBe("review-ready");
  });

  test("returns 422 when a pre-attempt-status hook rejects the transition", async () => {
    const status = await createAttemptStatus("blocked-by-hook");
    const workspace = await createWorkspace();
    writePlugin(
      "attempt-status-guard.ts",
      `export default { hooks: { preAttemptStatusChange(ctx) { if (ctx.toStatus === "blocked-by-hook") return { reject: true, reason: "blocked by test" }; } } };`,
    );

    const res = await app.request(`/v1/workspaces/${workspace.id}/attempt-status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "blocked-by-hook" }),
    });

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.hook_output).toContain("blocked by test");

    const unchanged = await appDeps.workspaceService.get(workspace.id);
    expect(unchanged?.attempt_status_id).not.toBe(status.id);
  });

  test("returns 422 when extension middleware rejects the host attempt-status command", async () => {
    const status = await createAttemptStatus("blocked-by-extension");
    const workspace = await createWorkspace();
    await writeExtension(
      "attempt-status-extension-guard",
      `
        export default {
          middlewares: {
            blockStatus: {
              commandId: "kernel.workspace.setAttemptStatus",
              handler(ctx) {
                if (ctx.params.status === "blocked-by-extension") {
                  return ctx.commands.reject({ code: "blocked", reason: "blocked by extension" });
                }
              },
            },
          },
        };
      `,
    );

    const res = await app.request(`/v1/workspaces/${workspace.id}/attempt-status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "blocked-by-extension" }),
    });

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.hook_output).toContain("blocked by extension");

    const unchanged = await appDeps.workspaceService.get(workspace.id);
    expect(unchanged?.attempt_status_id).not.toBe(status.id);
  });

  test("returns 404 for unknown workspace", async () => {
    const res = await app.request("/v1/workspaces/nonexistent/attempt-status", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "review-ready" }),
    });

    expect(res.status).toBe(404);
  });

  test("returns 404 for unknown status name", async () => {
    const workspace = await createWorkspace();

    const res = await app.request(`/v1/workspaces/${workspace.id}/attempt-status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "nonexistent-status" }),
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain("Attempt status not found");
  });
});
