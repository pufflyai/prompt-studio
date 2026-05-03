import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { createApp } from "../../../app";
import type { AppBindings } from "../../../types";

let app: OpenAPIHono<AppBindings>;
let tempRoot: string;
let projectId: string;
const ORIGINAL_PSTDIO_HOME = process.env.PSTDIO_HOME;

const createProject = async (name: string) => {
  const res = await app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name }),
  });
  expect(res.status).toBe(201);
  return (await res.json()) as { id: string };
};

const createTemplate = async (
  input: {
    name: string;
    template_type: string;
    content?: string;
    is_default?: boolean;
  },
  targetProjectId = projectId,
) => {
  const res = await app.request(`/v1/projects/${targetProjectId}/templates`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  expect(res.status).toBe(201);
  return res.json();
};

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-templates-test-"));
  // Isolate the merged template registry from any extensions installed under
  // the developer's real ~/.pstdio so this suite stays deterministic.
  const isolatedHome = join(tempRoot, "pstdio-home");
  mkdirSync(join(isolatedHome, "extensions"), { recursive: true });
  process.env.PSTDIO_HOME = isolatedHome;
  ({ app } = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
    filesRoot: "",
  }));

  const project = await createProject("Test Project");
  projectId = project.id;
});

afterAll(() => {
  rmSync(tempRoot, { recursive: true, force: true });
  if (ORIGINAL_PSTDIO_HOME === undefined) delete process.env.PSTDIO_HOME;
  else process.env.PSTDIO_HOME = ORIGINAL_PSTDIO_HOME;
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
    await createTemplate({
      name: "ticket-update-content",
      template_type: "ticket",
      content: "# {{TICKET_TITLE}}",
    });

    const res = await app.request(`/v1/projects/${projectId}/templates/ticket-update-content`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "# Updated {{TICKET_TITLE}}" }),
    });

    expect(res.status).toBe(200);

    const getRes = await app.request(`/v1/projects/${projectId}/templates/ticket-update-content`);
    const body = await getRes.json();
    expect(body.content).toBe("# Updated {{TICKET_TITLE}}");
  });

  test("rejects changing template_type for lone default template", async () => {
    const isolatedProject = await createProject("Lone Default Template Test");
    await createTemplate(
      {
        name: "lone-prompt",
        template_type: "prompt",
        content: "# {{PROMPT}}",
        is_default: true,
      },
      isolatedProject.id,
    );

    const beforeRes = await app.request(`/v1/projects/${isolatedProject.id}/templates/lone-prompt`);
    const before = await beforeRes.json();

    const res = await app.request(`/v1/projects/${isolatedProject.id}/templates/lone-prompt`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ template_type: "ticket", content: "# should-not-save" }),
    });

    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toBe("Cannot change template_type for the only default template in its current type");

    const getRes = await app.request(`/v1/projects/${isolatedProject.id}/templates/lone-prompt`);
    const updated = await getRes.json();
    expect(updated.template_type).toBe("prompt");
    expect(updated.content).toBe(before.content);
  });

  test("allows changing template_type when source type has another template", async () => {
    await createTemplate({
      name: "ticket-type-target",
      template_type: "ticket",
      content: "# Target",
      is_default: true,
    });
    await createTemplate({
      name: "ticket-type-spare",
      template_type: "ticket",
      content: "# Spare",
    });

    const res = await app.request(`/v1/projects/${projectId}/templates/ticket-type-target`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ template_type: "document" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("ticket-type-target");
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
    await createTemplate({
      name: "ticket-delete-soft",
      template_type: "ticket",
      content: "# Delete me",
    });
    const listBeforeRes = await app.request(`/v1/projects/${projectId}/templates`);
    const listBefore = await listBeforeRes.json();

    const res = await app.request(`/v1/projects/${projectId}/templates/ticket-delete-soft`, {
      method: "DELETE",
    });
    expect(res.status).toBe(204);

    const getRes = await app.request(`/v1/projects/${projectId}/templates/ticket-delete-soft`);
    expect(getRes.status).toBe(404);

    const listRes = await app.request(`/v1/projects/${projectId}/templates`);
    const list = await listRes.json();
    expect(list).toHaveLength(listBefore.length - 1);
    expect(list.find((template: { name: string }) => template.name === "ticket-delete-soft")).toBeUndefined();
  });

  test("returns 404 for missing template", async () => {
    const res = await app.request(`/v1/projects/${projectId}/templates/nonexistent`, {
      method: "DELETE",
    });
    expect(res.status).toBe(404);
  });

  test("hard-deletes a soft-deleted template and allows re-creation", async () => {
    await createTemplate({
      name: "ticket-hard-delete",
      template_type: "ticket",
      content: "# Delete me",
    });
    const softRes = await app.request(`/v1/projects/${projectId}/templates/ticket-hard-delete`, {
      method: "DELETE",
    });
    expect(softRes.status).toBe(204);

    const hardRes = await app.request(`/v1/projects/${projectId}/templates/ticket-hard-delete?hard=true`, {
      method: "DELETE",
    });
    expect(hardRes.status).toBe(204);

    const createRes = await app.request(`/v1/projects/${projectId}/templates`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "ticket-hard-delete", template_type: "ticket", content: "# recreated" }),
    });
    expect(createRes.status).toBe(201);
  });
});
