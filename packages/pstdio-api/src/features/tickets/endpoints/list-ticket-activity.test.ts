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

describe("GET /v1/tickets/:id/activity", () => {
  test("supports pagination and event_type filtering", async () => {
    const { app, projectId } = context;
    const createRes = await app.request("/v1/tickets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ project_id: projectId, content: "Activity ticket" }),
    });
    expect(createRes.status).toBe(201);
    const ticket = await createRes.json();

    const updateRes = await app.request(`/v1/tickets/${ticket.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ display_title: "Activity ticket updated" }),
    });
    expect(updateRes.status).toBe(200);

    const firstPageRes = await app.request(`/v1/tickets/${ticket.id}/activity?limit=1`);
    expect(firstPageRes.status).toBe(200);
    const firstPage = (await firstPageRes.json()) as {
      events: Array<{ event_type: string }>;
      next_cursor: string | null;
    };
    expect(firstPage.events).toHaveLength(1);
    expect(firstPage.next_cursor).toBeTruthy();

    const secondPageRes = await app.request(
      `/v1/tickets/${ticket.id}/activity?limit=1&cursor=${encodeURIComponent(firstPage.next_cursor!)}`,
    );
    expect(secondPageRes.status).toBe(200);
    const secondPage = (await secondPageRes.json()) as {
      events: Array<{ event_type: string }>;
    };
    expect(secondPage.events).toHaveLength(1);

    const filteredRes = await app.request(`/v1/tickets/${ticket.id}/activity?event_type=ticket_updated`);
    expect(filteredRes.status).toBe(200);
    const filtered = (await filteredRes.json()) as {
      events: Array<{ event_type: string; created_at: string }>;
    };
    expect(filtered.events).toHaveLength(1);
    expect(filtered.events[0].event_type).toBe("ticket_updated");

    const fromRes = await app.request(
      `/v1/tickets/${ticket.id}/activity?from=${encodeURIComponent(filtered.events[0].created_at)}`,
    );
    expect(fromRes.status).toBe(200);
    const fromFiltered = (await fromRes.json()) as {
      events: Array<{ event_type: string }>;
    };
    expect(fromFiltered.events.length).toBeGreaterThanOrEqual(1);
  });
});
