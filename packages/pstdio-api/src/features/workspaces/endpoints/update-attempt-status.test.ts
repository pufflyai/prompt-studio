import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { createFakeAgent } from "pstdio-agents";
import { createApp } from "../../../app";
import { waitForPath } from "../../../test-utils/wait-for-path";
import { waitForSyncEvent } from "../../../test-utils/wait-for-sync-event";
import type { AppBindings } from "../../../types";

let app: OpenAPIHono<AppBindings>;
let appDeps: Awaited<ReturnType<typeof createApp>>["deps"];
let eventBus: Awaited<ReturnType<typeof createApp>>["eventBus"];
let tempRoot: string;
let projectId: string;
let repoDir: string;
const repoRoot = join(import.meta.dirname, "../../../../../..");

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
  eventBus = created.eventBus;

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

  // Register repo so hooks can be discovered
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

const writePlugin = (fileName: string, code: string) => {
  const pluginsDir = join(repoDir, ".pstdio", "plugins");
  rmSync(pluginsDir, { recursive: true, force: true });
  mkdirSync(pluginsDir, { recursive: true });
  writeFileSync(join(pluginsDir, fileName), code);
  appDeps.pluginService.invalidate(projectId);
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

    // First set to "wip"
    await app.request(`/v1/workspaces/${workspace.id}/attempt-status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "wip" }),
    });

    // Then transition to "review-ready"
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

  test("returns 404 for unknown workspace", async () => {
    const res = await app.request("/v1/workspaces/nonexistent/attempt-status", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "review-ready" }),
    });

    expect(res.status).toBe(404);
  });

  test("returns 422 with hook output when pre-hook rejects", async () => {
    writePlugin(
      "guard.ts",
      `export default { hooks: { preAttemptStatusChange: () => ({ reject: true, reason: "lint: 3 errors found" }) } };`,
    );

    const workspace = await createWorkspace();

    const res = await app.request(`/v1/workspaces/${workspace.id}/attempt-status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "review-ready" }),
    });

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.hook_output).toContain("lint: 3 errors found");
  });

  test("returns 422 with reason when pre-hook rejects with message", async () => {
    writePlugin(
      "guard-2.ts",
      `export default { hooks: { preAttemptStatusChange: () => ({ reject: true, reason: "test suite failed: 2 failures" }) } };`,
    );

    const workspace = await createWorkspace();

    const res = await app.request(`/v1/workspaces/${workspace.id}/attempt-status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "review-ready" }),
    });

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.hook_output).toContain("test suite failed: 2 failures");
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

  test("fires post-hook immediately when no session_id is provided", async () => {
    const workspace = await createWorkspace();
    const outputPath = join(repoDir, `post-hook-${Date.now()}.txt`);

    writePlugin(
      "post-handler.ts",
      `import { writeFileSync } from "node:fs";
export default { hooks: { postAttemptStatusChange(ctx) { writeFileSync("${outputPath}", ctx.statusChangeId ?? "no-id"); } } };`,
    );

    const res = await app.request(`/v1/workspaces/${workspace.id}/attempt-status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "review-ready" }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { status_change_id: string };
    const fired = await waitForPath(outputPath);
    expect(fired).toBe(true);
    expect(readFileSync(outputPath, "utf-8").trim()).toBe(body.status_change_id);
  });

  test("includes rich ticket and workspace objects in attempt-status hook context", async () => {
    const workspace = await createWorkspace();
    const preOutputPath = join(repoDir, `pre-ticket-${Date.now()}.txt`);
    const postOutputPath = join(repoDir, `post-ticket-${Date.now()}.txt`);

    writePlugin(
      "ticket-check.ts",
      `import { writeFileSync } from "node:fs";
export default { hooks: {
  preAttemptStatusChange(ctx) { writeFileSync("${preOutputPath}", JSON.stringify({ ticket: ctx.ticket, workspace: ctx.workspace })); },
  postAttemptStatusChange(ctx) { writeFileSync("${postOutputPath}", JSON.stringify({ ticket: ctx.ticket, workspace: ctx.workspace })); },
} };`,
    );

    const res = await app.request(`/v1/workspaces/${workspace.id}/attempt-status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "review-ready" }),
    });

    expect(res.status).toBe(200);
    const preFired = await waitForPath(preOutputPath);
    const postFired = await waitForPath(postOutputPath);
    expect(preFired).toBe(true);
    expect(postFired).toBe(true);
    const preContext = JSON.parse(readFileSync(preOutputPath, "utf-8")) as {
      ticket: { id: string; shorthand: string; status_name: string | null };
      workspace: {
        id: string;
        workspace_shorthand: string;
        ticket_shorthand: string;
        attempt_status_name: string | null;
      };
    };
    const postContext = JSON.parse(readFileSync(postOutputPath, "utf-8")) as typeof preContext;

    expect(preContext.ticket.id).toBe(workspace.ticket.id);
    expect(preContext.ticket.shorthand).toBe(workspace.ticket.shorthand);
    expect(preContext.ticket.status_name).toBe("backlog");
    expect(preContext.workspace.id).toBe(workspace.id);
    expect(preContext.workspace.workspace_shorthand).toBe(workspace.workspace_shorthand);
    expect(preContext.workspace.ticket_shorthand).toBe(workspace.ticket.shorthand);
    expect(preContext.workspace.attempt_status_name).toBeNull();

    expect(postContext.ticket.id).toBe(workspace.ticket.id);
    expect(postContext.ticket.shorthand).toBe(workspace.ticket.shorthand);
    expect(postContext.ticket.status_name).toBe("backlog");
    expect(postContext.workspace.id).toBe(workspace.id);
    expect(postContext.workspace.workspace_shorthand).toBe(workspace.workspace_shorthand);
    expect(postContext.workspace.ticket_shorthand).toBe(workspace.ticket.shorthand);
    expect(postContext.workspace.attempt_status_name).toBe("review-ready");
  });

  test("includes original_session_id in post-hook context", async () => {
    const workspace = await createWorkspace();
    const outputPath = join(repoDir, `post-immediate-${Date.now()}.txt`);

    writePlugin(
      "post-check.ts",
      `import { writeFileSync } from "node:fs";
export default { hooks: {
  postAttemptStatusChange(ctx) {
    writeFileSync("${outputPath}", [ctx.sessionId ?? "", ctx.originalSessionId ?? ""].join("|"));
  },
} };`,
    );

    const originalSession = await appDeps.sessionService.create({
      project_id: projectId,
      title: "Original session",
      agent: "fake",
    });

    const reviewSession = await appDeps.sessionService.create({
      project_id: projectId,
      title: "Review session",
      agent: "fake",
      original_session_id: originalSession.id,
    });

    const res = await app.request(`/v1/workspaces/${workspace.id}/attempt-status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "changes-requested", session_id: reviewSession.id }),
    });

    expect(res.status).toBe(200);

    const fired = await waitForPath(outputPath);
    expect(fired).toBe(true);
    expect(readFileSync(outputPath, "utf-8").trim()).toBe(`${reviewSession.id}|${originalSession.id}`);
  });
});

describe("PATCH /v1/workspaces/:id/attempt-status with starter review lifecycle", () => {
  test("starts a fix session when review changes are requested without an original session", async () => {
    writePlugin(
      "code-review-lifecycle.ts",
      readFileSync(join(repoRoot, ".pstdio", "plugins", "code-review-lifecycle.ts"), "utf-8"),
    );

    const workspace = await createWorkspace();
    const existingSessionIds = new Set((await appDeps.sessionService.list(projectId)).map((session) => session.id));
    const reviewSession = await appDeps.sessionService.create({
      project_id: projectId,
      title: "Manual review",
      agent: "fake",
      cwd: process.cwd(),
    });
    existingSessionIds.add(reviewSession.id);

    const res = await app.request(`/v1/workspaces/${workspace.id}/attempt-status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "changes-requested", session_id: reviewSession.id }),
    });

    expect(res.status).toBe(200);

    const fixSessionCreated = waitForSyncEvent(
      eventBus,
      (event) =>
        event.table === "sessions" &&
        event.op === "set" &&
        !existingSessionIds.has((event.data as { id: string }).id) &&
        (event.data as { project_id: string }).project_id === projectId,
      1_000,
    );

    await appDeps.sessionService.transitionStatus(reviewSession.id, "completed");

    const fixSession = (await fixSessionCreated).data as {
      id: string;
      title: string;
      original_session_id: string | null;
    };

    expect(fixSession.title).toBe(`Fix changes requested: ${workspace.ticket.shorthand}`);
    expect(fixSession.original_session_id).toBe(reviewSession.id);
  });
});
