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

describe("POST /v1/tickets/:id/attempts hooks", () => {
  const setupHookTest = async (repoName: string, pluginFileName: string, pluginCode: string) => {
    const hookCtx = await createTicketsTestContext();
    const { app, projectId, createGitRepo, deps } = hookCtx;

    const repoRoot = createGitRepo(repoName);

    const { mkdirSync, writeFileSync } = await import("node:fs");
    const pluginsDir = join(repoRoot, ".pstdio", "plugins");
    mkdirSync(pluginsDir, { recursive: true });
    writeFileSync(join(pluginsDir, pluginFileName), pluginCode);

    const repoRes = await app.request(`/v1/projects/${projectId}/repos`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: repoName, path: repoRoot }),
    });
    expect(repoRes.status).toBe(201);
    const repo = await repoRes.json();
    deps.pluginService.invalidate(projectId);

    const ticketRes = await app.request("/v1/tickets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ project_id: projectId, content: "Hook test ticket" }),
    });
    expect(ticketRes.status).toBe(201);
    const ticket = await ticketRes.json();

    return { hookCtx, repoRoot, repo, ticket };
  };

  test("preWorktreeCreate receives context with workspace and ticket info", async () => {
    const ctxFilePath = join(context.tempRoot, "pre-worktree-create.ctx.json");
    const { hookCtx, repoRoot, repo, ticket } = await setupHookTest(
      "pre-create-payload-repo",
      "capture-ctx.ts",
      `import { writeFileSync } from "node:fs";
export default { hooks: { preWorktreeCreate(ctx) { writeFileSync("${ctxFilePath}", JSON.stringify(ctx)); } } };`,
    );

    const attemptRes = await hookCtx.app.request(`/v1/tickets/${ticket.id}/attempts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ repo_id: repo.id, mode: "worktree", start_session: false }),
    });
    expect(attemptRes.status).toBe(201);
    const attempt = await attemptRes.json();

    const ctx = JSON.parse(readFileSync(ctxFilePath, "utf8"));
    expect(ctx.repoPath).toBe(repoRoot);
    expect(ctx.projectId).toBe(hookCtx.projectId);
    expect(ctx.workspace).toBe(attempt.workspace.workspace_shorthand);
    expect(ctx.ticket).toBe(ticket.shorthand);
    expect(ctx.worktreePath).toBe(attempt.workspace.worktree_path);
    expect(ctx.base).toBe("HEAD");

    hookCtx.cleanup();
  });

  test("postWorktreeCreate fires after workspace creation", async () => {
    const markerPath = join(context.tempRoot, "post-create-marker.txt");
    const { hookCtx, repo, ticket } = await setupHookTest(
      "post-create-hook-repo",
      "post-create.ts",
      `import { writeFileSync } from "node:fs";
export default { hooks: { postWorktreeCreate() { writeFileSync("${markerPath}", "ok"); } } };`,
    );

    const attemptRes = await hookCtx.app.request(`/v1/tickets/${ticket.id}/attempts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ repo_id: repo.id, mode: "worktree", start_session: false }),
    });
    expect(attemptRes.status).toBe(201);

    await waitForFile(markerPath);
    expect(readFileSync(markerPath, "utf8")).toContain("ok");

    hookCtx.cleanup();
  });

  test("postWorktreeCreate runs alongside session creation", async () => {
    const markerPath = join(context.tempRoot, "hook-session-marker.txt");
    const { hookCtx, repo, ticket } = await setupHookTest(
      "hook-session-id-repo",
      "post-create-session.ts",
      `import { writeFileSync } from "node:fs";
export default { hooks: { postWorktreeCreate() { writeFileSync("${markerPath}", "ok"); } } };`,
    );

    const attemptRes = await hookCtx.app.request(`/v1/tickets/${ticket.id}/attempts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ repo_id: repo.id, agent: "fake", prompt: "Implement ticket", mode: "worktree" }),
    });
    expect(attemptRes.status).toBe(201);
    const attempt = await attemptRes.json();
    expect(attempt.session).not.toBeNull();

    await waitForFile(markerPath);

    hookCtx.cleanup();
  });

  test("surfaces preWorktreeCreate failures for workspace-only creation", async () => {
    const { hookCtx, repo, ticket } = await setupHookTest(
      "pre-create-reject-repo",
      "pre-create-reject.ts",
      `export default { hooks: { preWorktreeCreate() { return { reject: true, reason: "workspace guard failed" }; } } };`,
    );

    const attemptRes = await hookCtx.app.request(`/v1/tickets/${ticket.id}/attempts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ repo_id: repo.id, mode: "worktree", start_session: false }),
    });

    expect(attemptRes.status).toBe(500);
    const body = await attemptRes.json();
    expect(body.error).toBe("Internal server error");

    hookCtx.cleanup();
  });
});
