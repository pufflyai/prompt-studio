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

describe("POST /v1/tickets", () => {
  test("returns 404 when project does not exist", async () => {
    const { app } = context;
    const res = await app.request("/v1/tickets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ project_id: "non-existent", content: "Orphan ticket" }),
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain("Project not found");
  });

  test("creates a ticket", async () => {
    const { app, projectId } = context;
    const res = await app.request("/v1/tickets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ project_id: projectId, content: "First ticket" }),
    });

    expect(res.status).toBe(201);
    const ticket = await res.json();
    expect(ticket.shorthand).toBe("TP-1");
    expect(ticket.display_title).toBe("First ticket");
    expect(ticket.draft).toBe(false);

    const activityRes = await app.request(`/v1/tickets/${ticket.id}/activity`);
    expect(activityRes.status).toBe(200);
    const activity = (await activityRes.json()) as {
      events: Array<{ event_type: string; resource_id: string }>;
      next_cursor: string | null;
    };
    expect(activity.events).toHaveLength(1);
    expect(activity.events[0]).toMatchObject({ event_type: "ticket_created", resource_id: ticket.id });
    expect(activity.next_cursor).toBeNull();
  });

  test("creates a draft ticket", async () => {
    const { app, projectId } = context;
    const res = await app.request("/v1/tickets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ project_id: projectId, content: "Draft ticket", draft: true }),
    });

    expect(res.status).toBe(201);
    const ticket = await res.json();
    expect(ticket.draft).toBe(true);
  });

  test("stores user_prompt when provided", async () => {
    const { app, projectId } = context;
    const res = await app.request("/v1/tickets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        project_id: projectId,
        content: "Prompted ticket",
        user_prompt: "Fix the login bug",
      }),
    });

    expect(res.status).toBe(201);
    const ticket = await res.json();
    expect(ticket.user_prompt).toBe("Fix the login bug");
  });

  test("user_prompt is null when not provided", async () => {
    const { app, projectId } = context;
    const res = await app.request("/v1/tickets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ project_id: projectId, content: "No prompt" }),
    });

    expect(res.status).toBe(201);
    const ticket = await res.json();
    expect(ticket.user_prompt).toBeNull();
  });

  test("rejects legacy title field", async () => {
    const { app, projectId } = context;
    const res = await app.request("/v1/tickets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ project_id: projectId, title: "Legacy title field" }),
    });

    expect(res.status).toBe(400);
  });

  test("rejects display_title field", async () => {
    const { app, projectId } = context;
    const res = await app.request("/v1/tickets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ project_id: projectId, display_title: "Explicit title" }),
    });

    expect(res.status).toBe(400);
  });

  test("derives display_title from content heading", async () => {
    const { app, projectId } = context;
    const res = await app.request("/v1/tickets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ project_id: projectId, content: "# My dashboard ticket\n\nSome details here." }),
    });

    expect(res.status).toBe(201);
    const ticket = await res.json();
    expect(ticket.display_title).toBe("My dashboard ticket");
  });

  test("derives display_title from first non-empty line when no heading", async () => {
    const { app, projectId } = context;
    const res = await app.request("/v1/tickets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ project_id: projectId, content: "Fix the login bug" }),
    });

    expect(res.status).toBe(201);
    const ticket = await res.json();
    expect(ticket.display_title).toBe("Fix the login bug");
  });

  test("creates a ticket file from content and links it", async () => {
    const { app, projectId } = context;
    const content = "# File creation test\n\nBody content.";
    const res = await app.request("/v1/tickets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ project_id: projectId, content }),
    });

    expect(res.status).toBe(201);
    const ticket = await res.json();
    expect(ticket.file_id).not.toBeNull();

    const fileRes = await app.request(`/v1/tickets/${ticket.id}/files/${ticket.file_id}/content`);
    expect(fileRes.status).toBe(200);
    expect(await fileRes.text()).toBe(content);
  });

  test("creates a ticket with tag option ids and returns them via list", async () => {
    const { app, projectId } = context;

    const tagsRes = await app.request(`/v1/projects/${projectId}/ticket-tags`);
    const tags = (await tagsRes.json()) as { id: string; name: string; options: { id: string }[] }[];
    const optionId = tags[0].options[0].id;

    const createRes = await app.request("/v1/tickets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ project_id: projectId, content: "Tagged ticket", tag_ids: [optionId] }),
    });
    expect(createRes.status).toBe(201);
    const ticket = await createRes.json();

    const listRes = await app.request(`/v1/tickets?project_id=${projectId}`);
    const tickets = (await listRes.json()) as { id: string; tag_ids: string[] }[];
    const found = tickets.find((t) => t.id === ticket.id);
    expect(found?.tag_ids).toContain(optionId);
  });

  test("rejects display_title even when content is provided", async () => {
    const { app, projectId } = context;
    const res = await app.request("/v1/tickets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        project_id: projectId,
        content: "# Heading from content",
        display_title: "Explicit title",
      }),
    });

    expect(res.status).toBe(400);
  });
});
