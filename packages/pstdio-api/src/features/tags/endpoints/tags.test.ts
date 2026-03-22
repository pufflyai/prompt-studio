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

describe("GET /v1/projects/:projectId/ticket-tags", () => {
  test("lists default tag definitions with options", async () => {
    const { app, projectId } = context;
    const res = await app.request(`/v1/projects/${projectId}/ticket-tags`);

    expect(res.status).toBe(200);
    const tags = await res.json();
    expect(tags.length).toBe(3);

    const label = tags.find((t: { name: string }) => t.name === "label");
    expect(label.type).toBe("single_select");
    expect(label.options.length).toBe(4);

    const optionNames = label.options.map((o: { name: string }) => o.name);
    expect(optionNames).toContain("bug");
    expect(optionNames).toContain("feature");
    expect(optionNames).toContain("documentation");
    expect(optionNames).toContain("chore");

    expect(label.options[0].icon).toBe("bug");

    const complexity = tags.find((t: { name: string }) => t.name === "complexity");
    expect(complexity.options.length).toBe(3);
  });
});

describe("POST /v1/projects/:projectId/ticket-tags", () => {
  test("creates a tag definition with initial options", async () => {
    const { app, projectId } = context;
    const res = await app.request(`/v1/projects/${projectId}/ticket-tags`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "severity",
        type: "single_select",
        options: [
          { name: "critical", color: "red" },
          { name: "major", color: "orange" },
        ],
      }),
    });

    expect(res.status).toBe(201);
    const tag = await res.json();
    expect(tag.name).toBe("severity");
    expect(tag.type).toBe("single_select");
    expect(tag.options.length).toBe(2);
    expect(tag.options[0].name).toBe("critical");
  });

  test("creates a tag definition without initial options", async () => {
    const { app, projectId } = context;
    const res = await app.request(`/v1/projects/${projectId}/ticket-tags`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "components", type: "multi_select" }),
    });

    expect(res.status).toBe(201);
    const tag = await res.json();
    expect(tag.name).toBe("components");
    expect(tag.type).toBe("multi_select");
    expect(tag.options.length).toBe(0);
  });
});

describe("PUT /v1/projects/:projectId/ticket-tags/:id", () => {
  test("updates a tag definition name", async () => {
    const { app, projectId } = context;

    const listRes = await app.request(`/v1/projects/${projectId}/ticket-tags`);
    const tags = await listRes.json();
    const components = tags.find((t: { name: string }) => t.name === "components");

    const res = await app.request(`/v1/projects/${projectId}/ticket-tags/${components.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "modules" }),
    });

    expect(res.status).toBe(200);
    const updated = await res.json();
    expect(updated.name).toBe("modules");
  });
});

describe("DELETE /v1/projects/:projectId/ticket-tags/:id", () => {
  test("deletes a tag definition", async () => {
    const { app, projectId } = context;

    const listRes = await app.request(`/v1/projects/${projectId}/ticket-tags`);
    const tags = await listRes.json();
    const modules = tags.find((t: { name: string }) => t.name === "modules");

    const res = await app.request(`/v1/projects/${projectId}/ticket-tags/${modules.id}`, {
      method: "DELETE",
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deleted).toBe(true);

    const afterRes = await app.request(`/v1/projects/${projectId}/ticket-tags`);
    const afterTags = await afterRes.json();
    expect(afterTags.find((t: { id: string }) => t.id === modules.id)).toBeUndefined();
  });
});

describe("POST /v1/projects/:projectId/ticket-tags/:tagId/options", () => {
  test("adds an option to a tag definition", async () => {
    const { app, projectId } = context;

    const listRes = await app.request(`/v1/projects/${projectId}/ticket-tags`);
    const tags = await listRes.json();
    const severity = tags.find((t: { name: string }) => t.name === "severity");

    const res = await app.request(`/v1/projects/${projectId}/ticket-tags/${severity.id}/options`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "P3", color: "yellow" }),
    });

    expect(res.status).toBe(201);
    const option = await res.json();
    expect(option.name).toBe("P3");
    expect(option.color).toBe("yellow");
  });
});

describe("PUT /v1/projects/:projectId/ticket-tags/:tagId/options/:optionId", () => {
  test("updates a tag option", async () => {
    const { app, projectId } = context;

    const listRes = await app.request(`/v1/projects/${projectId}/ticket-tags`);
    const tags = await listRes.json();
    const severity = tags.find((t: { name: string }) => t.name === "severity");
    const p3 = severity.options.find((o: { name: string }) => o.name === "P3");

    const res = await app.request(`/v1/projects/${projectId}/ticket-tags/${severity.id}/options/${p3.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "P3 - Low", color: "green" }),
    });

    expect(res.status).toBe(200);
    const updated = await res.json();
    expect(updated.name).toBe("P3 - Low");
    expect(updated.color).toBe("green");
  });

  test("updates a tag option sort_order", async () => {
    const { app, projectId } = context;

    const listRes = await app.request(`/v1/projects/${projectId}/ticket-tags`);
    const tags = await listRes.json();
    const severity = tags.find((t: { name: string }) => t.name === "severity");
    const p1 = severity.options.find((o: { name: string }) => o.name === "critical");

    const res = await app.request(`/v1/projects/${projectId}/ticket-tags/${severity.id}/options/${p1.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sort_order: 99 }),
    });

    expect(res.status).toBe(200);
    const updated = await res.json();
    expect(updated.sort_order).toBe(99);
  });
});

describe("DELETE /v1/projects/:projectId/ticket-tags/:tagId/options/:optionId", () => {
  test("deletes a tag option", async () => {
    const { app, projectId } = context;

    const listRes = await app.request(`/v1/projects/${projectId}/ticket-tags`);
    const tags = await listRes.json();
    const severity = tags.find((t: { name: string }) => t.name === "severity");
    const p3 = severity.options.find((o: { name: string }) => o.name === "P3 - Low");

    const res = await app.request(`/v1/projects/${projectId}/ticket-tags/${severity.id}/options/${p3.id}`, {
      method: "DELETE",
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deleted).toBe(true);
  });
});
