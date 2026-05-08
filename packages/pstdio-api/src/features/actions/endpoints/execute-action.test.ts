import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { execSync } from "node:child_process";
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
let repoId: string;
const previousPstdioHomeEnv = process.env.PSTDIO_HOME;

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-exec-action-"));
  process.env.PSTDIO_HOME = join(tempRoot, "pstdio-home");
  const repoPath = join(tempRoot, "repo");
  const pluginsDir = join(repoPath, ".pstdio", "plugins");
  mkdirSync(pluginsDir, { recursive: true });
  execSync("git init", { cwd: repoPath, stdio: "ignore" });
  execSync('git config user.email "test@test.com"', { cwd: repoPath, stdio: "ignore" });
  execSync('git config user.name "Test"', { cwd: repoPath, stdio: "ignore" });
  writeFileSync(join(repoPath, "README.md"), "execute action test\n");
  execSync("git add README.md", { cwd: repoPath, stdio: "ignore" });
  execSync('git commit -m "init"', { cwd: repoPath, stdio: "ignore" });

  writeFileSync(
    join(pluginsDir, "test-actions.ts"),
    `import { renderPrompt } from "@pstdio/sdk/plugins";

    export default {
      actions: [
        {
          key: "noop",
          label: "No-op",
          targetType: "ticket",
          placement: "primary",
          async trigger() {},
        },
        {
          key: "with-params",
          label: "With params",
          targetType: "ticket",
          placement: "overflow",
          params: [
            { key: "name", label: "Name", type: "text" },
            { key: "agent", label: "Agent", type: "agent" },
          ],
          async trigger() {},
        },
        {
          key: "start-attempt",
          label: "Start attempt",
          targetType: "ticket",
          placement: "primary",
          params: [{ key: "repo", label: "Repo", type: "text" }],
          async trigger(ctx) {
            return ctx.client.tickets.createAttempt(ctx.targetId, {
              repo_id: String(ctx.params.repo),
              start_session: false,
            });
          },
        },
        {
          key: "returns-session",
          label: "Returns session",
          targetType: "ticket",
          placement: "primary",
          async trigger() {
            return { session_id: "explicit-session-123" };
          },
        },
        {
          key: "capture-shorthand",
          label: "Capture shorthand",
          targetType: "ticket",
          placement: "primary",
          async trigger(ctx) {
            return { session_id: String(ctx.target.shorthand) };
          },
        },
        {
          key: "legacy-run-attempt",
          label: "Legacy run attempt",
          targetType: "ticket",
          placement: "primary",
          params: [{ key: "repo", label: "Repo", type: "text" }],
          async trigger(ctx) {
            return ctx.client.tickets.createAttempt(ctx.targetId, {
              repo_id: String(ctx.params.repo),
              prompt: renderPrompt(ctx.prompts["implement-ticket"], { ticket_id: ctx.target.shorthand }),
              start_session: false,
            });
          },
        },
      ],
    };`,
  );

  ({ app, close } = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
    filesRoot: resolveTestFilesRoot(),
  }));

  const projRes = await app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Execute Action Test" }),
  });
  const proj = await projRes.json();
  projectId = proj.id;

  const repoRes = await app.request(`/v1/projects/${projectId}/repos`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "test-repo", path: repoPath }),
  });
  repoId = (await repoRes.json()).id;
});

afterAll(async () => {
  await close();
  if (previousPstdioHomeEnv === undefined) {
    delete process.env.PSTDIO_HOME;
  } else {
    process.env.PSTDIO_HOME = previousPstdioHomeEnv;
  }
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("POST /v1/projects/:projectId/actions/:actionKey/execute", () => {
  test("executes a registered action", async () => {
    // Create a ticket as the target
    const ticketRes = await app.request("/v1/tickets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ project_id: projectId, user_prompt: "test" }),
    });
    const ticket = await ticketRes.json();

    const res = await app.request(`/v1/projects/${projectId}/actions/test-actions%2Fnoop/execute`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ target_type: "ticket", target_id: ticket.id }),
    });

    expect(res.status).toBe(200);
    const result = await res.json();
    expect(result.status).toBe("success");
  });

  test("executes an action with params", async () => {
    const ticketRes = await app.request("/v1/tickets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ project_id: projectId, user_prompt: "test params" }),
    });
    const ticket = await ticketRes.json();

    const res = await app.request(`/v1/projects/${projectId}/actions/test-actions%2Fwith-params/execute`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        target_type: "ticket",
        target_id: ticket.id,
        params: {
          name: "hello",
          agent: { agent: "claude-code", model: "opus" },
        },
      }),
    });

    expect(res.status).toBe(200);
    const result = await res.json();
    expect(result.status).toBe("success");
  });

  test("returns 404 for unknown action key", async () => {
    const res = await app.request(`/v1/projects/${projectId}/actions/unknown%2Faction/execute`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ target_type: "ticket", target_id: "some-id" }),
    });

    expect(res.status).toBe(404);
  });

  test("executes actions that call back into the API client", async () => {
    const ticketRes = await app.request("/v1/tickets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ project_id: projectId, user_prompt: "start attempt" }),
    });
    const ticket = await ticketRes.json();

    const res = await app.request(`/v1/projects/${projectId}/actions/test-actions%2Fstart-attempt/execute`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        target_type: "ticket",
        target_id: ticket.id,
        params: { repo: repoId },
      }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "success" });

    const workspacesRes = await app.request(`/v1/workspaces?project_id=${projectId}`);
    const workspaces = await workspacesRes.json();
    expect(workspaces).toHaveLength(1);
    expect(workspaces[0]?.ticket_shorthand).toBe(ticket.shorthand);
  });

  test("returns session_id when action explicitly provides one", async () => {
    const ticketRes = await app.request("/v1/tickets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ project_id: projectId, user_prompt: "session return" }),
    });
    const ticket = await ticketRes.json();

    const res = await app.request(`/v1/projects/${projectId}/actions/test-actions%2Freturns-session/execute`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ target_type: "ticket", target_id: ticket.id }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "success", session_id: "explicit-session-123" });
  });

  test("does not return session_id when action returns unrelated data", async () => {
    const res = await app.request(`/v1/projects/${projectId}/actions/test-actions%2Fstart-attempt/execute`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        target_type: "ticket",
        target_id: (
          await (
            await app.request("/v1/tickets", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ project_id: projectId, user_prompt: "no session" }),
            })
          ).json()
        ).id,
        params: { repo: repoId },
      }),
    });

    expect(res.status).toBe(200);
    const result = await res.json();
    expect(result.status).toBe("success");
    expect(result.session_id).toBeUndefined();
  });

  test("resolves ticket target by shorthand and exposes ctx.target.shorthand", async () => {
    const ticketRes = await app.request("/v1/tickets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ project_id: projectId, user_prompt: "shorthand target" }),
    });
    const ticket = await ticketRes.json();

    const res = await app.request(`/v1/projects/${projectId}/actions/test-actions%2Fcapture-shorthand/execute`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ target_type: "ticket", target_id: ticket.shorthand }),
    });

    expect(res.status).toBe(200);
    const result = await res.json();
    expect(result.status).toBe("success");
    expect(result.session_id).toBe(ticket.shorthand);
  });

  test("executes legacy actions that render project prompt templates from ctx.prompts", async () => {
    const ticketRes = await app.request("/v1/tickets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ project_id: projectId, user_prompt: "legacy prompt attempt" }),
    });
    const ticket = await ticketRes.json();

    const res = await app.request(`/v1/projects/${projectId}/actions/test-actions%2Flegacy-run-attempt/execute`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        target_type: "ticket",
        target_id: ticket.id,
        params: { repo: repoId },
      }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "success" });

    const workspacesRes = await app.request(`/v1/workspaces?project_id=${projectId}`);
    const workspaces = await workspacesRes.json();
    expect(
      workspaces.some((workspace: { ticket_shorthand: string }) => workspace.ticket_shorthand === ticket.shorthand),
    ).toBe(true);
  });
});
