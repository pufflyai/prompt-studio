import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { TicketsTestContext } from "../../tickets/endpoints/tickets-test-harness";
import { createTicketsTestContext } from "../../tickets/endpoints/tickets-test-harness";

let context!: TicketsTestContext;

beforeAll(async () => {
  context = await createTicketsTestContext();
});

afterAll(() => {
  context.cleanup();
});

describe("PATCH /v1/projects/:projectId/statuses/:id", () => {
  test("updates name, color, and order for a status", async () => {
    const { app, projectId } = context;

    const createRes = await app.request(`/v1/projects/${projectId}/statuses`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "triage", color: "teal" }),
    });
    const created = await createRes.json();

    const updateRes = await app.request(`/v1/projects/${projectId}/statuses/${created.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "queued", color: "pink", sort_order: 1 }),
    });

    expect(updateRes.status).toBe(200);
    const updated = await updateRes.json();
    expect(updated.name).toBe("queued");
    expect(updated.color).toBe("pink");
    expect(updated.sort_order).toBe(1);
  });

  test("updates action fields for a status", async () => {
    const { app, projectId } = context;

    const createRes = await app.request(`/v1/projects/${projectId}/statuses`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "active", color: "blue" }),
    });
    const created = await createRes.json();

    expect(created.can_create).toBe(false);
    expect(created.column_actions).toEqual([]);

    const updateRes = await app.request(`/v1/projects/${projectId}/statuses/${created.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        can_create: true,
        can_drag_in: false,
        column_actions: ["archive_all"],
      }),
    });

    expect(updateRes.status).toBe(200);
    const updated = await updateRes.json();
    expect(updated.can_create).toBe(true);
    expect(updated.can_drag_in).toBe(false);
    expect(updated.can_drag_out).toBe(true);
    expect(updated.column_actions).toEqual(["archive_all"]);
  });
});
