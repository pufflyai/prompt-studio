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

const createTicket = async (content: string, options: Record<string, unknown> = {}) => {
  const { app, projectId } = context;
  const res = await app.request("/v1/tickets", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ project_id: projectId, content, ...options }),
  });

  expect(res.status).toBe(201);
  return res.json();
};

describe("GET /v1/tickets", () => {
  test("lists non-draft tickets by default", async () => {
    await createTicket("Backlog ticket");
    await createTicket("Draft ticket", { draft: true });

    const { app, projectId } = context;
    const res = await app.request(`/v1/tickets?project_id=${projectId}`);

    expect(res.status).toBe(200);
    const tickets = await res.json();
    expect(tickets.length).toBeGreaterThanOrEqual(1);
    expect(tickets.every((ticket: { draft: boolean }) => !ticket.draft)).toBe(true);
    expect(tickets[0].status_name).toBeDefined();
    expect(tickets[0].tag_names).toBeDefined();
  });

  test("lists draft tickets when requested", async () => {
    const createdDraft = await createTicket("Only drafts", { draft: true });

    const { app, projectId } = context;
    const res = await app.request(`/v1/tickets?project_id=${projectId}&draft=true`);

    expect(res.status).toBe(200);
    const tickets = await res.json();
    expect(tickets.length).toBeGreaterThanOrEqual(1);
    expect(tickets.every((ticket: { draft: boolean }) => ticket.draft)).toBe(true);
    expect(tickets.some((ticket: { id: string }) => ticket.id === createdDraft.id)).toBe(true);
  });

  test("filters by shorthand", async () => {
    const created = await createTicket("Shorthand filter ticket");

    const { app, projectId } = context;
    const res = await app.request(`/v1/tickets?project_id=${projectId}&shorthand=${created.shorthand}`);

    expect(res.status).toBe(200);
    const tickets = await res.json();
    expect(tickets.length).toBe(1);
    expect(tickets[0].shorthand).toBe(created.shorthand);
  });

  test("filters by search term", async () => {
    const { app, projectId } = context;
    await createTicket("# Search only ticket\n\nContains a unique phrase", {
      user_prompt: "investigate flaky search indexing",
    });

    const res = await app.request(`/v1/tickets?project_id=${projectId}&search=flaky search`);

    expect(res.status).toBe(200);
    const tickets = await res.json();
    expect(tickets.length).toBe(1);
    expect(tickets[0].user_prompt).toContain("flaky search indexing");
  });

  test("includes archived tickets in default list", async () => {
    const created = await createTicket("Soon archived");

    const { app, projectId } = context;
    const archiveRes = await app.request(`/v1/tickets/${created.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ archived: true }),
    });
    expect(archiveRes.status).toBe(200);

    const allRes = await app.request(`/v1/tickets?project_id=${projectId}`);
    const all = await allRes.json();
    expect(all.some((ticket: { id: string }) => ticket.id === created.id)).toBe(true);

    const nonArchivedRes = await app.request(`/v1/tickets?project_id=${projectId}&archived=false`);
    const nonArchived = await nonArchivedRes.json();
    expect(nonArchived.some((ticket: { id: string }) => ticket.id === created.id)).toBe(false);

    const archivedRes = await app.request(`/v1/tickets?project_id=${projectId}&archived=true`);
    const archived = await archivedRes.json();
    expect(archived.some((ticket: { id: string }) => ticket.id === created.id)).toBe(true);
  });

  test("returns 400 when unknown query params are provided", async () => {
    const { app, projectId } = context;
    const res = await app.request(`/v1/tickets?project_id=${projectId}&x=1`);

    expect(res.status).toBe(400);
  });
});
