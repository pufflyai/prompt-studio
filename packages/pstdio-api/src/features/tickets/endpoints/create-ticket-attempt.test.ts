import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { TicketsTestContext } from "./tickets-test-harness";
import { createTicketsTestContext } from "./tickets-test-harness";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const waitForWorkspaceSession = async (context: TicketsTestContext, workspaceId: string, timeoutMs = 5000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() <= deadline) {
    const sessions = await context.deps.workspaceSessionService.listByWorkspace(workspaceId);
    if (sessions[0]) return sessions[0];
    await sleep(50);
  }

  throw new Error(`Timed out waiting for workspace session ${workspaceId}`);
};

let context!: TicketsTestContext;

beforeAll(async () => {
  context = await createTicketsTestContext();
});

afterAll(() => {
  context.cleanup();
});

const createTicket = async () => {
  const { app, projectId } = context;
  const ticketRes = await app.request("/v1/tickets", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ project_id: projectId, content: "Attempt ticket content" }),
  });

  expect(ticketRes.status).toBe(201);
  return ticketRes.json();
};

describe("POST /v1/tickets/:id/attempts", () => {
  test("creates workspace worktree and session for run attempt", async () => {
    const { app, projectId, createGitRepo } = context;
    const repoRoot = createGitRepo("attempt-success-repo");

    const repoRes = await app.request(`/v1/projects/${projectId}/repos`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "attempt-success-repo", path: repoRoot }),
    });
    expect(repoRes.status).toBe(201);
    const repo = await repoRes.json();

    const ticketRes = await app.request("/v1/tickets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ project_id: projectId, content: "# Attempt success ticket\n\nImplement me" }),
    });
    expect(ticketRes.status).toBe(201);
    const ticket = await ticketRes.json();

    const attemptRes = await app.request(`/v1/tickets/${ticket.id}/attempts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        repo_id: repo.id,
        agent: "fake",
        prompt: "Implement ticket",
        mode: "worktree",
      }),
    });

    expect(attemptRes.status).toBe(201);
    const attempt = await attemptRes.json();
    expect(attempt.mode).toBe("worktree");
    expect(attempt.ticket.id).toBe(ticket.id);
    expect(attempt.workspace.workspace_shorthand).toMatch(/^TP-\d+_A\d+$/);
    expect(attempt.workspace.branch).toBe(`workspace/${attempt.workspace.workspace_shorthand}`);
    expect(attempt.workspace.worktree_path).toContain(attempt.workspace.workspace_shorthand);
    expect(attempt.session).toBeNull();

    const session = await waitForWorkspaceSession(context, attempt.workspace.id);
    expect(session.status).toBe("in_progress");

    const activityRes = await app.request(`/v1/tickets/${ticket.id}/activity`);
    expect(activityRes.status).toBe(200);
    const activity = (await activityRes.json()) as {
      events: Array<{ event_type: string; payload_json: { workspace_id?: string } }>;
    };
    expect(activity.events[0].event_type).toBe("ticket_attempt_created");
    expect(activity.events[0].payload_json.workspace_id).toBe(attempt.workspace.id);
  });

  test("copies .pstdio/config.json into worktree", async () => {
    const { app, projectId, createGitRepo } = context;
    const repoRoot = createGitRepo("attempt-pstdio-config-repo");

    const repoRes = await app.request(`/v1/projects/${projectId}/repos`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "attempt-pstdio-config-repo", path: repoRoot }),
    });
    expect(repoRes.status).toBe(201);
    const repo = await repoRes.json();

    expect(existsSync(join(repoRoot, ".pstdio", "config.json"))).toBe(true);

    const ticket = await createTicket();

    const attemptRes = await app.request(`/v1/tickets/${ticket.id}/attempts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        repo_id: repo.id,
        mode: "worktree",
        start_session: false,
      }),
    });
    expect(attemptRes.status).toBe(201);
    const attempt = await attemptRes.json();

    const wtConfigPath = join(attempt.workspace.worktree_path, ".pstdio", "config.json");
    expect(existsSync(wtConfigPath)).toBe(true);
    const config = JSON.parse(readFileSync(wtConfigPath, "utf8"));
    expect(config.project_id).toBe(projectId);
  });

  test("supports workspace-only creation when start_session is false", async () => {
    const { app, projectId, createGitRepo } = context;
    const repoRoot = createGitRepo("attempt-workspace-only-repo");

    const repoRes = await app.request(`/v1/projects/${projectId}/repos`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "attempt-workspace-only-repo", path: repoRoot }),
    });
    expect(repoRes.status).toBe(201);
    const repo = await repoRes.json();

    const ticket = await createTicket();

    const attemptRes = await app.request(`/v1/tickets/${ticket.id}/attempts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        repo_id: repo.id,
        mode: "worktree",
        start_session: false,
      }),
    });

    expect(attemptRes.status).toBe(201);
    const attempt = await attemptRes.json();
    expect(attempt.mode).toBe("worktree");
    expect(attempt.session).toBeNull();
    expect(attempt.workspace.branch).toBe(`workspace/${attempt.workspace.workspace_shorthand}`);
    expect(await context.deps.workspaceSessionService.listByWorkspace(attempt.workspace.id)).toEqual([]);
  });
});
