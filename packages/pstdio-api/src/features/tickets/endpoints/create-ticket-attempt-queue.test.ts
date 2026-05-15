import { describe, expect, test } from "bun:test";
import type { TicketsTestContext } from "./tickets-test-harness";
import { createTicketsTestContext } from "./tickets-test-harness";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForWorkspaceSession = async (context: TicketsTestContext, workspaceId: string) => {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const sessions = await context.deps.workspaceSessionService.listByWorkspace(workspaceId);
    if (sessions.length > 0) return sessions[0]!;
    await sleep(25);
  }

  throw new Error("Timed out waiting for ticket attempt session link");
};

describe("POST /v1/tickets/:id/attempts queueing", () => {
  test("queues the attempt session only after the workspace is ready", async () => {
    const context = await createTicketsTestContext();
    const { app, projectId, createGitRepo } = context;

    try {
      const repoRoot = createGitRepo("attempt-queue-after-ready-repo");

      const repoRes = await app.request(`/v1/projects/${projectId}/repos`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "attempt-queue-after-ready-repo", path: repoRoot }),
      });
      expect(repoRes.status).toBe(201);
      const repo = await repoRes.json();

      const ticketRes = await app.request("/v1/tickets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ project_id: projectId, content: "Attempt queue ticket" }),
      });
      expect(ticketRes.status).toBe(201);
      const ticket = await ticketRes.json();

      await app.request("/v1/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ max_concurrent_sessions: 1 }),
      });
      await context.deps.sessionService.create({
        project_id: projectId,
        title: "Capacity holder",
        agent: "fake",
        cwd: repoRoot,
      });

      const attemptRes = await app.request(`/v1/tickets/${ticket.id}/attempts`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ repo_id: repo.id, agent: "fake", prompt: "Implement ticket", mode: "worktree" }),
      });
      expect(attemptRes.status).toBe(201);
      const attempt = await attemptRes.json();
      expect(attempt.workspace.initializing).toBe(true);
      expect(attempt.session).toBeNull();
      expect(await context.deps.workspaceSessionService.listByWorkspace(attempt.workspace.id)).toEqual([]);

      const session = await waitForWorkspaceSession(context, attempt.workspace.id);
      expect(session).toMatchObject({ status: "queued" });
      expect(session?.cwd).toContain(attempt.workspace.workspace_shorthand);

      const entries = await context.deps.sessionQueueEntriesService.listPending();
      expect(entries).toContainEqual(
        expect.objectContaining({ session_id: session.id, prompt: "Implement ticket", request_kind: "start" }),
      );
    } finally {
      context.cleanup();
    }
  }, 15_000);

  test("rejects an unknown requested agent before creating a workspace", async () => {
    const context = await createTicketsTestContext();
    const { app, projectId, createGitRepo } = context;

    try {
      const repoRoot = createGitRepo("attempt-unknown-agent-repo");
      const repoRes = await app.request(`/v1/projects/${projectId}/repos`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "attempt-unknown-agent-repo", path: repoRoot }),
      });
      expect(repoRes.status).toBe(201);
      const repo = await repoRes.json();

      const ticketRes = await app.request("/v1/tickets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ project_id: projectId, content: "Unknown agent ticket" }),
      });
      expect(ticketRes.status).toBe(201);
      const ticket = await ticketRes.json();

      const attemptRes = await app.request(`/v1/tickets/${ticket.id}/attempts`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ repo_id: repo.id, agent: "missing-agent", mode: "worktree" }),
      });

      expect(attemptRes.status).toBe(400);
      expect(await context.deps.workspaceService.listByTicketId(ticket.id)).toEqual([]);
      expect(await context.deps.sessionQueueEntriesService.listPending()).toEqual([]);
    } finally {
      context.cleanup();
    }
  });

  test("returns queued status for synchronous current-branch attempt sessions", async () => {
    const context = await createTicketsTestContext();
    const { app, projectId, createGitRepo } = context;

    try {
      const repoRoot = createGitRepo("attempt-current-branch-queued-status-repo");
      const repoRes = await app.request(`/v1/projects/${projectId}/repos`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "attempt-current-branch-queued-status-repo", path: repoRoot }),
      });
      expect(repoRes.status).toBe(201);
      const repo = await repoRes.json();

      const ticketRes = await app.request("/v1/tickets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ project_id: projectId, content: "Current branch queued status ticket" }),
      });
      expect(ticketRes.status).toBe(201);
      const ticket = await ticketRes.json();

      await app.request("/v1/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ max_concurrent_sessions: 1 }),
      });
      await context.deps.sessionService.create({
        project_id: projectId,
        title: "Capacity holder",
        agent: "fake",
        cwd: repoRoot,
      });

      const attemptRes = await app.request(`/v1/tickets/${ticket.id}/attempts`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ repo_id: repo.id, agent: "fake", prompt: "Implement ticket", mode: "current_branch" }),
      });
      expect(attemptRes.status).toBe(201);
      const attempt = await attemptRes.json();

      expect(attempt.session).toMatchObject({ status: "queued" });
    } finally {
      context.cleanup();
    }
  });
});
