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
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-templates-test-"));
  ({ app } = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
  }));

  const res = await app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Test Project" }),
  });
  const project = await res.json();
  projectId = project.id;
});

afterAll(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("POST /v1/projects/:id/templates", () => {
  test("creates a template and returns 201", async () => {
    const res = await app.request(`/v1/projects/${projectId}/templates`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "custom-ticket",
        template_type: "ticket",
        content: "# {{TICKET_TITLE}}",
        is_default: false,
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe("custom-ticket");
    expect(body.template_type).toBe("ticket");
    expect(body.is_default).toBe(false);
  });

  test("uses placeholder content when content is omitted", async () => {
    const res = await app.request(`/v1/projects/${projectId}/templates`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "blank-template",
        template_type: "prompt",
      }),
    });

    expect(res.status).toBe(201);

    const getRes = await app.request(`/v1/projects/${projectId}/templates/blank-template`);
    const body = await getRes.json();
    expect(body.content).toBe("# blank-template\n");
  });

  test("returns 409 for duplicate name", async () => {
    const res = await app.request(`/v1/projects/${projectId}/templates`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "custom-ticket",
        template_type: "ticket",
        content: "duplicate",
      }),
    });

    expect(res.status).toBe(409);
  });
});

describe("GET /v1/projects/:id/templates", () => {
  test("lists templates", async () => {
    const res = await app.request(`/v1/projects/${projectId}/templates`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveLength(9);
    expect(body.map((template: { name: string }) => template.name)).toEqual([
      "adr",
      "blank-template",
      "cookbook",
      "custom-ticket",
      "lessons-learned",
      "prd",
      "proposal",
      "review-me",
      "ticket",
    ]);
  });
});

describe("GET /v1/projects/:id/templates/:name", () => {
  test("returns template with content", async () => {
    const res = await app.request(`/v1/projects/${projectId}/templates/ticket`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.name).toBe("ticket");
    expect(body.content).toContain("# {{TICKET_TITLE}}");
    expect(body.content).toContain('ticket_id: "{{TICKET_ID}}"');
  });

  test("returns lessons-learned template with bracket placeholders", async () => {
    const res = await app.request(`/v1/projects/${projectId}/templates/lessons-learned`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.name).toBe("lessons-learned");
    expect(body.content).toContain("## Summary\n\n[One paragraph.]");
    expect(body.content).toContain("## Impact\n\n[Who or what was affected?]");
    expect(body.content).toContain("## Detection\n\n[How was it noticed? CI, user report, local dev, etc.]");
  });

  test("returns 404 for missing template", async () => {
    const res = await app.request(`/v1/projects/${projectId}/templates/nonexistent`);
    expect(res.status).toBe(404);
  });
});

describe("PUT /v1/projects/:id/templates/:name", () => {
  test("updates template content", async () => {
    const res = await app.request(`/v1/projects/${projectId}/templates/ticket`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "# Updated {{TICKET_TITLE}}" }),
    });

    expect(res.status).toBe(200);

    const getRes = await app.request(`/v1/projects/${projectId}/templates/ticket`);
    const body = await getRes.json();
    expect(body.content).toBe("# Updated {{TICKET_TITLE}}");
  });

  test("returns 404 for missing template", async () => {
    const res = await app.request(`/v1/projects/${projectId}/templates/nonexistent`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "x" }),
    });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /v1/projects/:id/templates/:name", () => {
  test("soft-deletes and returns 204", async () => {
    const res = await app.request(`/v1/projects/${projectId}/templates/ticket`, {
      method: "DELETE",
    });
    expect(res.status).toBe(204);

    const getRes = await app.request(`/v1/projects/${projectId}/templates/ticket`);
    expect(getRes.status).toBe(404);

    const listRes = await app.request(`/v1/projects/${projectId}/templates`);
    const list = await listRes.json();
    expect(list).toHaveLength(8);
    expect(list.find((template: { name: string }) => template.name === "ticket")).toBeUndefined();
  });

  test("returns 404 for missing template", async () => {
    const res = await app.request(`/v1/projects/${projectId}/templates/nonexistent`, {
      method: "DELETE",
    });
    expect(res.status).toBe(404);
  });
});
