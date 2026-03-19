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

describe("POST /v1/projects/:projectId/ticket-tags", () => {
  test("creates a tag", async () => {
    const { app, projectId } = context;
    const res = await app.request(`/v1/projects/${projectId}/ticket-tags`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "urgent", color: "#ff0000" }),
    });

    expect(res.status).toBe(201);
    const tag = await res.json();
    expect(tag.name).toBe("urgent");
    expect(tag.color).toBe("#ff0000");
  });
});

describe("GET /v1/projects/:projectId/ticket-tags", () => {
  test("lists tags for project", async () => {
    const { app, projectId } = context;
    const res = await app.request(`/v1/projects/${projectId}/ticket-tags`);

    expect(res.status).toBe(200);
    const tags = await res.json();
    expect(tags.length).toBeGreaterThanOrEqual(1);
  });
});

describe("PUT /v1/projects/:projectId/ticket-tags/:id", () => {
  test("updates a tag", async () => {
    const { app, projectId } = context;

    const createRes = await app.request(`/v1/projects/${projectId}/ticket-tags`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "wip", color: "#00ff00" }),
    });
    const created = await createRes.json();

    const res = await app.request(`/v1/projects/${projectId}/ticket-tags/${created.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "in-progress", color: "#0000ff" }),
    });

    expect(res.status).toBe(200);
    const updated = await res.json();
    expect(updated.name).toBe("in-progress");
    expect(updated.color).toBe("#0000ff");
  });
});

describe("DELETE /v1/projects/:projectId/ticket-tags/:id", () => {
  test("deletes a tag", async () => {
    const { app, projectId } = context;

    const createRes = await app.request(`/v1/projects/${projectId}/ticket-tags`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "to-delete", color: "#aaaaaa" }),
    });
    const created = await createRes.json();

    const res = await app.request(`/v1/projects/${projectId}/ticket-tags/${created.id}`, {
      method: "DELETE",
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deleted).toBe(true);

    // Verify it no longer appears in the list
    const listRes = await app.request(`/v1/projects/${projectId}/ticket-tags`);
    const tags = await listRes.json();
    expect(tags.find((t: { id: string }) => t.id === created.id)).toBeUndefined();
  });
});
