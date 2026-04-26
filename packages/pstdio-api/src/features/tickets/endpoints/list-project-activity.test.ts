import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { TicketsTestContext } from "./tickets-test-harness";
import { createTicketsTestContext } from "./tickets-test-harness";

let context!: TicketsTestContext;

beforeAll(async () => {
  context = await createTicketsTestContext();
});

afterAll(() => {
  context.cleanup();
});

describe("GET /v1/projects/:id/activity", () => {
  test("supports pagination plus event_type/from/to filters", async () => {
    const { app, projectId } = context;

    const firstRes = await app.request("/v1/tickets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ project_id: projectId, content: "Cursor A" }),
    });
    expect(firstRes.status).toBe(201);

    const secondRes = await app.request("/v1/tickets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ project_id: projectId, content: "Cursor B" }),
    });
    expect(secondRes.status).toBe(201);

    const firstPageRes = await app.request(`/v1/projects/${projectId}/activity?resource_type=ticket&limit=1`);
    expect(firstPageRes.status).toBe(200);
    const firstPage = (await firstPageRes.json()) as {
      events: Array<{ event_type: string }>;
      next_cursor: string | null;
    };
    expect(firstPage.events).toHaveLength(1);
    expect(firstPage.events[0].event_type).toBe("ticket_created");
    expect(firstPage.next_cursor).toBeTruthy();

    const secondPageRes = await app.request(
      `/v1/projects/${projectId}/activity?resource_type=ticket&limit=1&cursor=${encodeURIComponent(firstPage.next_cursor!)}`,
    );
    expect(secondPageRes.status).toBe(200);
    const secondPage = (await secondPageRes.json()) as {
      events: Array<{ event_type: string }>;
    };
    expect(secondPage.events).toHaveLength(1);
    expect(secondPage.events[0].event_type).toBe("ticket_created");

    const eventTypeFilteredRes = await app.request(
      `/v1/projects/${projectId}/activity?resource_type=ticket&event_type=ticket_created`,
    );
    expect(eventTypeFilteredRes.status).toBe(200);
    const eventTypeFiltered = (await eventTypeFilteredRes.json()) as {
      events: Array<{ event_type: string; created_at: string }>;
    };
    expect(eventTypeFiltered.events.length).toBeGreaterThan(0);
    expect(eventTypeFiltered.events.every((event) => event.event_type === "ticket_created")).toBe(true);

    const pivotCreatedAt = eventTypeFiltered.events[0].created_at;
    const fromFilteredRes = await app.request(
      `/v1/projects/${projectId}/activity?resource_type=ticket&from=${encodeURIComponent(pivotCreatedAt)}`,
    );
    expect(fromFilteredRes.status).toBe(200);
    const fromFiltered = (await fromFilteredRes.json()) as {
      events: Array<{ created_at: string }>;
    };
    expect(fromFiltered.events.length).toBeGreaterThan(0);
    expect(fromFiltered.events.every((event) => event.created_at >= pivotCreatedAt)).toBe(true);

    const toFilteredRes = await app.request(
      `/v1/projects/${projectId}/activity?resource_type=ticket&to=${encodeURIComponent(pivotCreatedAt)}`,
    );
    expect(toFilteredRes.status).toBe(200);
    const toFiltered = (await toFilteredRes.json()) as {
      events: Array<{ created_at: string }>;
    };
    expect(toFiltered.events.length).toBeGreaterThan(0);
    expect(toFiltered.events.every((event) => event.created_at <= pivotCreatedAt)).toBe(true);
  });
});
