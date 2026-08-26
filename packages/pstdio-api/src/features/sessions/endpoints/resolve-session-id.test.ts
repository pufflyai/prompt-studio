import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { createTestApp } from "../../../test-utils/create-test-app";
import type { AppBindings } from "../../../types";

let app: OpenAPIHono<AppBindings>;
let tempRoot: string;
let projectId: string;
let deps: Awaited<ReturnType<typeof createTestApp>>["deps"];

const makeAgentSessionId = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`;

const createMappedSession = async (input: {
  agentSessionId: string;
  status?: "in_progress" | "awaiting_input" | "completed" | "failed" | "cancelled";
  cwd?: string;
  agent?: string;
}) => {
  const session = await deps.sessionService.create({
    project_id: projectId,
    title: `session-${crypto.randomUUID().slice(0, 8)}`,
    agent: input.agent ?? "opencode",
    cwd: input.cwd,
  });

  await deps.sessionService.update(session.id, {
    agent_session_id: input.agentSessionId,
  });

  if (input.status && input.status !== "in_progress") {
    await deps.sessionService.transitionStatus(session.id, input.status);
  }

  return session;
};

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-resolve-session-id-test-"));
  const created = await createTestApp({ databasePath: ":memory:", storageRoot: join(tempRoot, "storage") });

  app = created.app;
  deps = created.deps;

  const project = await deps.projectService.create({ name: "resolve-session-id-project" });
  projectId = project.id;
});

afterAll(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("POST /v1/sessions/resolve-session-id", () => {
  test("returns mapped session id when a single match exists", async () => {
    const agentSessionId = makeAgentSessionId("single");
    const created = await createMappedSession({ agentSessionId, cwd: "/repo/a" });

    const res = await app.request("/v1/sessions/resolve-session-id", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        agent: "opencode",
        agent_session_id: agentSessionId,
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ session_id: created.id });
  });

  test("returns session_id null when no match exists", async () => {
    const res = await app.request("/v1/sessions/resolve-session-id", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        agent: "opencode",
        agent_session_id: makeAgentSessionId("missing"),
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ session_id: null });
  });

  test("prefers active sessions over terminal sessions", async () => {
    const agentSessionId = makeAgentSessionId("active-priority");
    await createMappedSession({
      agentSessionId,
      status: "completed",
      cwd: "/repo/terminal",
    });
    const active = await createMappedSession({
      agentSessionId,
      status: "awaiting_input",
      cwd: "/repo/active",
    });

    const res = await app.request("/v1/sessions/resolve-session-id", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        agent: "opencode",
        agent_session_id: agentSessionId,
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ session_id: active.id });
  });

  test("uses cwd as tie-break when multiple active matches exist", async () => {
    const agentSessionId = makeAgentSessionId("cwd");
    await createMappedSession({ agentSessionId, status: "in_progress", cwd: "/repo/a" });
    const match = await createMappedSession({ agentSessionId, status: "awaiting_input", cwd: "/repo/b" });

    const res = await app.request("/v1/sessions/resolve-session-id", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        agent: "opencode",
        agent_session_id: agentSessionId,
        cwd: "/repo/b",
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ session_id: match.id });
  });

  test("returns 409 when multiple active matches remain ambiguous", async () => {
    const agentSessionId = makeAgentSessionId("ambiguous");
    await createMappedSession({ agentSessionId, status: "in_progress", cwd: "/repo/a" });
    await createMappedSession({ agentSessionId, status: "awaiting_input", cwd: "/repo/b" });

    const res = await app.request("/v1/sessions/resolve-session-id", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        agent: "opencode",
        agent_session_id: agentSessionId,
      }),
    });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body).toEqual({ error: "Ambiguous session match" });
  });

  test("returns 409 when cwd tie-break is still ambiguous", async () => {
    const agentSessionId = makeAgentSessionId("ambiguous-cwd");
    await createMappedSession({ agentSessionId, status: "in_progress", cwd: "/repo/same" });
    await createMappedSession({ agentSessionId, status: "awaiting_input", cwd: "/repo/same" });

    const res = await app.request("/v1/sessions/resolve-session-id", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        agent: "opencode",
        agent_session_id: agentSessionId,
        cwd: "/repo/same",
      }),
    });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body).toEqual({ error: "Ambiguous session match" });
  });
});
