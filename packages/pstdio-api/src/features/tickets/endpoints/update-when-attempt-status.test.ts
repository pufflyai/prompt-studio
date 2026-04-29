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
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-update-when-attempt-"));

  ({ app } = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
    filesRoot: "",
    agents: [],
  }));

  const projectRes = await app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Test Project" }),
  });
  const project = await projectRes.json();
  projectId = project.id;
});

afterAll(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

const createTicketWithWorkspace = async (attemptStatusName?: string) => {
  const ticketRes = await app.request("/v1/tickets", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ project_id: projectId }),
  });
  const ticket = await ticketRes.json();

  const wsRes = await app.request("/v1/workspaces", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      project_id: projectId,
      ticket_id: ticket.id,
      ticket_shorthand: ticket.shorthand,
    }),
  });
  const workspace = await wsRes.json();

  if (attemptStatusName) {
    await app.request(`/v1/workspaces/${workspace.id}/attempt-status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: attemptStatusName }),
    });
  }

  return { ticket, workspace };
};

describe("POST /v1/tickets/:id/update-when-attempt-status", () => {
  test("updates ticket when all attempts match the status", async () => {
    const { ticket } = await createTicketWithWorkspace("reviewed");

    // Get the target ticket status to verify
    const statusesRes = await app.request(`/v1/projects/${projectId}/ticket-statuses`);
    const statuses = (await statusesRes.json()) as { id: string; name: string }[];
    const reviewStatus = statuses.find((s) => s.name === "review");

    const res = await app.request(`/v1/tickets/${ticket.id}/update-when-attempt-status`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        all_attempts_status: "reviewed",
        set_status: "review",
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.updated).toBe(true);

    // Verify ticket status changed
    const ticketRes = await app.request(`/v1/tickets/${ticket.id}`);
    const updatedTicket = await ticketRes.json();
    expect(updatedTicket.status_id).toBe(reviewStatus!.id);

    const activityRes = await app.request(`/v1/tickets/${ticket.id}/activity`);
    expect(activityRes.status).toBe(200);
    const activity = (await activityRes.json()) as {
      events: Array<{ event_type: string; payload_json: { to_status?: string } }>;
    };
    expect(activity.events[0].event_type).toBe("ticket_attempt_status_updated");
    expect(activity.events[0].payload_json.to_status).toBe("review");
  });

  test("no-ops when not all attempts match", async () => {
    const ticketRes = await app.request("/v1/tickets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ project_id: projectId }),
    });
    const ticket = await ticketRes.json();

    // Create two workspaces - one reviewed, one running
    const ws1Res = await app.request("/v1/workspaces", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        project_id: projectId,
        ticket_id: ticket.id,
        ticket_shorthand: ticket.shorthand,
      }),
    });
    const ws1 = await ws1Res.json();

    await app.request("/v1/workspaces", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        project_id: projectId,
        ticket_id: ticket.id,
        ticket_shorthand: ticket.shorthand,
      }),
    });

    await app.request(`/v1/workspaces/${ws1.id}/attempt-status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "reviewed" }),
    });

    // ws2 has no attempt status set, so it doesn't match
    const res = await app.request(`/v1/tickets/${ticket.id}/update-when-attempt-status`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        all_attempts_status: "reviewed",
        set_status: "review",
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.updated).toBe(false);
  });

  test("returns 404 for unknown ticket", async () => {
    const res = await app.request("/v1/tickets/nonexistent/update-when-attempt-status", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        all_attempts_status: "reviewed",
        set_status: "review",
      }),
    });

    expect(res.status).toBe(404);
  });

  test("does not emit duplicate activity on no-op status transition", async () => {
    const { ticket } = await createTicketWithWorkspace("reviewed");

    const firstRes = await app.request(`/v1/tickets/${ticket.id}/update-when-attempt-status`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        all_attempts_status: "reviewed",
        set_status: "review",
      }),
    });
    expect(firstRes.status).toBe(200);
    expect((await firstRes.json()).updated).toBe(true);

    const secondRes = await app.request(`/v1/tickets/${ticket.id}/update-when-attempt-status`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        all_attempts_status: "reviewed",
        set_status: "review",
      }),
    });
    expect(secondRes.status).toBe(200);
    expect((await secondRes.json()).updated).toBe(false);

    const activityRes = await app.request(`/v1/tickets/${ticket.id}/activity?event_type=ticket_attempt_status_updated`);
    expect(activityRes.status).toBe(200);
    const activity = (await activityRes.json()) as { events: Array<{ event_type: string }> };
    expect(activity.events).toHaveLength(1);
    expect(activity.events[0].event_type).toBe("ticket_attempt_status_updated");
  });
});
