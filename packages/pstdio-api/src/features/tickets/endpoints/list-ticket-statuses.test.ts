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

describe("GET /v1/projects/:projectId/ticket-statuses", () => {
  test("returns statuses for project", async () => {
    const { app, projectId } = context;
    const res = await app.request(`/v1/projects/${projectId}/ticket-statuses`);

    expect(res.status).toBe(200);
    const statuses = await res.json();
    expect(statuses.length).toBeGreaterThanOrEqual(6);
    expect(statuses.map((status: { name: string }) => status.name)).toContain("backlog");
    expect(statuses.map((status: { name: string }) => status.name)).toContain("wip");
  });

  test("does not return archived statuses", async () => {
    const { app, projectId } = context;

    const createRes = await app.request(`/v1/projects/${projectId}/statuses`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "triage", color: "teal" }),
    });
    const created = await createRes.json();

    const archiveRes = await app.request(`/v1/projects/${projectId}/statuses/${created.id}`, {
      method: "DELETE",
    });
    expect(archiveRes.status).toBe(200);

    const res = await app.request(`/v1/projects/${projectId}/ticket-statuses`);
    expect(res.status).toBe(200);
    const statuses = await res.json();

    expect(statuses.find((status: { id: string }) => status.id === created.id)).toBeUndefined();
  });
});
