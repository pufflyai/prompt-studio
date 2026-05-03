import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { createApp } from "../../../app";
import type { AppBindings } from "../../../types";

let app: OpenAPIHono<AppBindings>;
let tempRoot: string;

const makeEmbeddedTemplateFile = (fileName: string, content: string) => {
  const blob = new Blob([content], { type: "text/markdown" });
  return Object.assign(blob, { name: `../files/templates/${fileName}` });
};

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-create-project-test-"));
  ({ app } = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
    filesRoot: "",
  }));
});

afterAll(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("POST /v1/projects", () => {
  test("creates a project and returns 201", async () => {
    const res = await app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Test Project", agents: ["opencode"] }),
    });

    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.name).toBe("Test Project");
    expect(body.id).toBeDefined();
    expect(body.selected_agents).toBe('["opencode"]');
  });

  test("returns 400 when request body contains unknown keys", async () => {
    const res = await app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Strict Project", unknown_key: "value" }),
    });

    expect(res.status).toBe(400);
  });

  test("does not seed project-owned templates from embedded repo files", async () => {
    const runtime = Bun as unknown as { embeddedFiles: (Blob & { name: string })[] };
    const originalEmbeddedFiles = runtime.embeddedFiles;
    runtime.embeddedFiles = [makeEmbeddedTemplateFile("tickets/ticket.md", "# embedded:tickets/ticket.md\n")];

    try {
      const createRes = await app.request("/v1/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "No Repo Seed Project" }),
      });
      expect(createRes.status).toBe(201);

      const project = (await createRes.json()) as { id: string };
      const templatesRes = await app.request(`/v1/projects/${project.id}/templates?sourceKind=project`);
      expect(templatesRes.status).toBe(200);
      expect(await templatesRes.json()).toEqual([]);
    } finally {
      runtime.embeddedFiles = originalEmbeddedFiles;
    }
  });
});
