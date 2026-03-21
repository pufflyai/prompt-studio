import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { TicketsTestContext } from "./tickets-test-harness";
import { createTicketsTestContext } from "./tickets-test-harness";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const waitForFile = async (path: string, timeoutMs = 5000) => {
  const deadline = Date.now() + timeoutMs;
  while (!existsSync(path)) {
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${path}`);
    await sleep(50);
  }
};

const waitFor = async (predicate: () => Promise<boolean>, timeoutMs = 5000) => {
  const deadline = Date.now() + timeoutMs;
  while (!(await predicate())) {
    if (Date.now() > deadline) throw new Error("waitFor timed out");
    await sleep(50);
  }
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
    expect(attempt.session.workspace_id).toBe(attempt.workspace.id);
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

    // .pstdio/config.json should now exist in the main repo (written by register-repo)
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
    expect(attempt.workspace.session_id).toBeNull();
    expect(attempt.workspace.branch).toBe(`workspace/${attempt.workspace.workspace_shorthand}`);
  });

  test("runs post-create hook for workspace creation and stores hook log", async () => {
    const { app, projectId, createGitRepo } = context;
    const repoRoot = createGitRepo("attempt-post-create-hook-repo");

    // Write post-create hook to .pstdio/hooks/
    const { mkdirSync, writeFileSync } = await import("node:fs");
    const hooksDir = join(repoRoot, ".pstdio", "hooks");
    mkdirSync(hooksDir, { recursive: true });
    writeFileSync(join(hooksDir, "post-create"), 'echo "post-create hook ran" && echo "ok" > post-create-marker.txt');

    const repoRes = await app.request(`/v1/projects/${projectId}/repos`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "attempt-post-create-hook-repo", path: repoRoot }),
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

    // Hook runs in the background (fire-and-forget), so wait for it to finish
    const markerPath = join(attempt.workspace.worktree_path, "post-create-marker.txt");
    await waitForFile(markerPath);
    expect(readFileSync(markerPath, "utf8")).toContain("ok");

    // Wait for the hook log to be persisted
    const startupLogUrl = `/v1/workspaces/${attempt.workspace.id}/startup-log`;
    await waitFor(async () => {
      const res = await app.request(startupLogUrl, { method: "GET" });
      return res.status === 200 && (await res.text()).includes("post-create hook ran");
    });
    const logRes = await app.request(startupLogUrl, { method: "GET" });
    expect(logRes.status).toBe(200);
    const logContent = await logRes.text();
    expect(logContent).toContain("post-create hook ran");
  });
});
