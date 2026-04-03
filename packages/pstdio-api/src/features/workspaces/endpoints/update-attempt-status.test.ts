import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
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
  const workspace = (await wsRes.json()) as { id: string };
  return { ...workspace, ticketShorthand: ticket.shorthand };
};

const writeHook = (hookName: string, script: string) => {
  const hooksDir = join(repoDir, ".pstdio", "hooks");
  mkdirSync(hooksDir, { recursive: true });
  const path = join(hooksDir, hookName);
  writeFileSync(path, `#!/bin/sh\n${script}`);
  chmodSync(path, 0o755);
};

const waitForPath = async (path: string, timeoutMs = 1_000) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (existsSync(path)) return true;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  return false;
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
    writeHook("pre-attempt-status-review-ready", 'echo "lint: 3 errors found" >&2; exit 1');

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

  test("returns 422 with stdout when pre-hook writes to stdout and exits non-zero", async () => {
    writeHook("pre-attempt-status-review-ready", 'echo "test suite failed: 2 failures"; exit 1');

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
    const outputPath = join(repoDir, `post-attempt-status-review-ready-${Date.now()}.txt`);
    writeHook("pre-attempt-status-review-ready", "exit 0");
    writeHook(
      "post-attempt-status-review-ready",
      `if [ "$PSTDIO_WORKSPACE_ID" = "${workspace.id}" ]; then echo "$PSTDIO_STATUS_CHANGE_ID" > "${outputPath}"; fi`,
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

  test("includes ticket in attempt-status hook payload", async () => {
    const workspace = await createWorkspace();
    const preOutputPath = join(repoDir, `pre-attempt-status-review-ready-ticket-${Date.now()}.txt`);
    const postOutputPath = join(repoDir, `post-attempt-status-review-ready-ticket-${Date.now()}.txt`);

    writeHook(
      "pre-attempt-status-review-ready",
      `set -eu\nif [ "$PSTDIO_WORKSPACE_ID" = "${workspace.id}" ]; then echo "$PSTDIO_TICKET" > "${preOutputPath}"; fi`,
    );
    writeHook(
      "post-attempt-status-review-ready",
      `set -eu\nif [ "$PSTDIO_WORKSPACE_ID" = "${workspace.id}" ]; then echo "$PSTDIO_TICKET" > "${postOutputPath}"; fi`,
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
    expect(readFileSync(preOutputPath, "utf-8").trim()).toBe(workspace.ticketShorthand);
    expect(readFileSync(postOutputPath, "utf-8").trim()).toBe(workspace.ticketShorthand);
  });

  test("includes original_session_id in deferred post-hook payload", async () => {
    const workspace = await createWorkspace();
    const outputPath = join(repoDir, `post-attempt-status-changes-requested-orig-${Date.now()}.txt`);

    writeHook(
      "post-attempt-status-changes-requested",
      `set -eu
if [ "$PSTDIO_WORKSPACE_ID" = "${workspace.id}" ]; then
  printf '%s|%s' "$PSTDIO_SESSION_ID" "\${PSTDIO_ORIGINAL_SESSION_ID:-}" > "${outputPath}"
fi`,
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
    expect(existsSync(outputPath)).toBe(false);

    await appDeps.sessionService.transitionStatus(reviewSession.id, "completed");

    const fired = await waitForPath(outputPath);
    expect(fired).toBe(true);
    expect(readFileSync(outputPath, "utf-8").trim()).toBe(`${reviewSession.id}|${originalSession.id}`);
  });
});
