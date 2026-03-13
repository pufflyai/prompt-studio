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

describe("GET /v1/projects/:projectId/ticket-tags", () => {
  test("returns tags for project", async () => {
    const { app, projectId } = context;
    const res = await app.request(`/v1/projects/${projectId}/ticket-tags`);

    expect(res.status).toBe(200);
    const tags = await res.json();
    expect(tags.length).toBeGreaterThanOrEqual(3);
    expect(tags.map((tag: { name: string }) => tag.name)).toContain("bug");
  });
});
