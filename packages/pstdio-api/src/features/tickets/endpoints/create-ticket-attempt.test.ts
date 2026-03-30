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
    expect(attempt.workspace.branch).toBe(`workspace/${attempt.workspace.workspace_shorthand}`);
  });
});

describe("POST /v1/tickets/:id/attempts hooks", () => {
  test("pre-worktree-create payload is available via stdin and field env vars", async () => {
    const { app, projectId, createGitRepo } = context;
    const repoRoot = createGitRepo("attempt-pre-create-payload-repo");

    const { chmodSync, mkdirSync, writeFileSync } = await import("node:fs");
    const hooksDir = join(repoRoot, ".pstdio", "hooks");
    mkdirSync(hooksDir, { recursive: true });

    const stdinPath = join(repoRoot, "pre-worktree-create.payload.stdin.json");
    const envPath = join(repoRoot, "pre-worktree-create.payload.env.json");
    writeFileSync(
      join(hooksDir, "pre-worktree-create"),
      `#!/bin/sh
cat > "${stdinPath}"
printf '{"repo_path":"%s","branch":"%s","workspace":"%s","ticket":"%s","project_id":"%s"}' \
"$PSTDIO_REPO_PATH" \
"$PSTDIO_BRANCH" \
"$PSTDIO_WORKSPACE" \
"$PSTDIO_TICKET" \
"$PSTDIO_PROJECT_ID" > "${envPath}"
`,
    );
    chmodSync(join(hooksDir, "pre-worktree-create"), 0o755);

    const repoRes = await app.request(`/v1/projects/${projectId}/repos`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "attempt-pre-create-payload-repo", path: repoRoot }),
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

    const stdinPayload = JSON.parse(readFileSync(stdinPath, "utf8"));
    const envPayload = JSON.parse(readFileSync(envPath, "utf8"));

    expect(envPayload.repo_path).toBe(stdinPayload.repo_path);
    expect(envPayload.branch).toBe(stdinPayload.branch);
    expect(envPayload.workspace).toBe(stdinPayload.workspace);
    expect(envPayload.ticket).toBe(stdinPayload.ticket);
    expect(envPayload.project_id).toBe(stdinPayload.project_id);
    expect(stdinPayload.repo_path).toBe(repoRoot);
    expect(stdinPayload.project_id).toBe(projectId);
    expect(stdinPayload.workspace).toBe(attempt.workspace.workspace_shorthand);
    expect(stdinPayload.ticket).toBe(ticket.shorthand);
    expect(stdinPayload.worktree_path).toBe(attempt.workspace.worktree_path);
    expect(stdinPayload.base).toBe("HEAD");
  });

  test("runs post-create hook for workspace creation and stores hook log", async () => {
    const { app, projectId, createGitRepo } = context;
    const repoRoot = createGitRepo("attempt-post-create-hook-repo");

    // Write post-create hook to .pstdio/hooks/
    const { chmodSync, mkdirSync, writeFileSync } = await import("node:fs");
    const hooksDir = join(repoRoot, ".pstdio", "hooks");
    mkdirSync(hooksDir, { recursive: true });
    const hookPath = join(hooksDir, "post-worktree-create");
    writeFileSync(hookPath, '#!/bin/sh\necho "post-create hook ran" && echo "ok" > post-create-marker.txt');
    chmodSync(hookPath, 0o755);

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

  test("post-create hook runs alongside session creation", async () => {
    const { app, projectId, createGitRepo } = context;
    const repoRoot = createGitRepo("attempt-hook-session-id-repo");

    const { chmodSync: chmod, mkdirSync: mkDir, writeFileSync: writeFile } = await import("node:fs");
    const hooksDir = join(repoRoot, ".pstdio", "hooks");
    mkDir(hooksDir, { recursive: true });
    const hookPath = join(hooksDir, "post-worktree-create");
    writeFile(hookPath, '#!/bin/sh\necho "hook ran" && echo "ok" > hook-marker.txt');
    chmod(hookPath, 0o755);

    const repoRes = await app.request(`/v1/projects/${projectId}/repos`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "attempt-hook-session-id-repo", path: repoRoot }),
    });
    expect(repoRes.status).toBe(201);
    const repo = await repoRes.json();

    const ticket = await createTicket();

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
    expect(attempt.session).not.toBeNull();

    // Wait for the post-create hook to finish
    const markerPath = join(attempt.workspace.worktree_path, "hook-marker.txt");
    await waitForFile(markerPath);
    await waitFor(async () => {
      const res = await app.request(`/v1/workspaces/${attempt.workspace.id}/startup-log`, { method: "GET" });
      return res.status === 200;
    });
  });
});
