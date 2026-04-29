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
    filesRoot: "",
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
    expect(body.some((template: { name: string }) => template.name === "blank-template")).toBe(true);
    expect(body.some((template: { name: string }) => template.name === "custom-ticket")).toBe(true);
  });
});

describe("GET /v1/projects/:id/templates/:name", () => {
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

  test("rejects changing template_type for lone default template", async () => {
    // Remove seeded prompts so blank-template becomes the only prompt
    for (const name of [
      "commit-message",
      "create-sub-tickets",
      "implement-ticket",
      "refine-ticket",
      "squash-message",
      "fix-changes-requested",
      "review-code",
    ]) {
      await app.request(`/v1/projects/${projectId}/templates/${name}`, { method: "DELETE" });
    }

    const makeDefaultRes = await app.request(`/v1/projects/${projectId}/templates/blank-template`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ is_default: true }),
    });
    expect(makeDefaultRes.status).toBe(200);

    const beforeRes = await app.request(`/v1/projects/${projectId}/templates/blank-template`);
    const before = await beforeRes.json();

    const res = await app.request(`/v1/projects/${projectId}/templates/blank-template`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ template_type: "ticket", content: "# should-not-save" }),
    });

    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toBe("Cannot change template_type for the only default template in its current type");

    const getRes = await app.request(`/v1/projects/${projectId}/templates/blank-template`);
    const updated = await getRes.json();
    expect(updated.template_type).toBe("prompt");
    expect(updated.content).toBe(before.content);
  });

  test("allows changing template_type when source type has another template", async () => {
    const res = await app.request(`/v1/projects/${projectId}/templates/ticket`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ template_type: "document" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("ticket");
    expect(body.template_type).toBe("document");
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
    expect(list).toHaveLength(14);
    expect(list.find((template: { name: string }) => template.name === "ticket")).toBeUndefined();
  });

  test("returns 404 for missing template", async () => {
    const res = await app.request(`/v1/projects/${projectId}/templates/nonexistent`, {
      method: "DELETE",
    });
    expect(res.status).toBe(404);
  });

  test("hard-deletes a soft-deleted template and allows re-creation", async () => {
    const hardRes = await app.request(`/v1/projects/${projectId}/templates/ticket?hard=true`, {
      method: "DELETE",
    });
    expect(hardRes.status).toBe(204);

    const createRes = await app.request(`/v1/projects/${projectId}/templates`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "ticket", template_type: "ticket", content: "# recreated" }),
    });
    expect(createRes.status).toBe(201);
  });
});
