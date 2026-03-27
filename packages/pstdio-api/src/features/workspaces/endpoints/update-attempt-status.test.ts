import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { createApp } from "../../../app";
import type { AppBindings } from "../../../types";

let app: OpenAPIHono<AppBindings>;
let tempRoot: string;
let projectId: string;

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-attempt-status-test-"));
  ({ app } = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
  }));

  const projectRes = await app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "attempt-status-test" }),
  });
  const project = await projectRes.json();
  projectId = project.id;
});

afterAll(() => {
  rmSync(tempRoot, { recursive: true, force: true });
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
  return (await wsRes.json()) as { id: string };
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
