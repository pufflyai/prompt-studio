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
        name: "ticket",
        template_type: "ticket",
        content: "# {{TICKET_TITLE}}",
        is_default: true,
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe("ticket");
    expect(body.template_type).toBe("ticket");
    expect(body.is_default).toBe(true);
  });

  test("returns 409 for duplicate name", async () => {
    const res = await app.request(`/v1/projects/${projectId}/templates`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "ticket",
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
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe("ticket");
  });
});

describe("GET /v1/projects/:id/templates/:name", () => {
  test("returns template with content", async () => {
    const res = await app.request(`/v1/projects/${projectId}/templates/ticket`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.name).toBe("ticket");
    expect(body.content).toBe("# {{TICKET_TITLE}}");
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
    expect(list).toHaveLength(0);
  });

  test("returns 404 for missing template", async () => {
    const res = await app.request(`/v1/projects/${projectId}/templates/nonexistent`, {
      method: "DELETE",
    });
    expect(res.status).toBe(404);
  });
});
