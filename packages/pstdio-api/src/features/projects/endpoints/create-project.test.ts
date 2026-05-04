import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { chmodSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { createApp } from "../../../app";
import type { AppBindings } from "../../../types";

let app: OpenAPIHono<AppBindings>;
let tempRoot: string;
const TEMPLATE_FILES = [
  "documents/prd.template.md",
  "documents/adr.template.md",
  "documents/changelog-entry.template.md",
  "documents/cookbook.template.md",
  "documents/lessons-learned.template.md",
  "documents/code-review.template.md",
  "documents/architecture-overview.template.md",
  "documents/contracts.template.md",
  "documents/research.template.md",
  "documents/schemas.template.md",
  "prompts/commit-message.prompt.md",
  "prompts/create-sub-tickets.prompt.md",
  "prompts/implement-ticket.prompt.md",
  "prompts/refine-ticket.prompt.md",
  "prompts/squash-message.prompt.md",
  "prompts/fix-changes-requested.prompt.md",
  "prompts/review-code.prompt.md",
  "tickets/bug-fix.ticket.md",
  "tickets/ticket.md",
  "tickets/proposal.ticket.md",
];

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
    expect(body.selected_agents).toEqual(["opencode"]);
    expect(body.default_agent_id).toBeNull();
    expect(body.default_agent_model).toBeNull();
  });

  test("returns 400 when request body contains unknown keys", async () => {
    const res = await app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Strict Project", unknown_key: "value" }),
    });

    expect(res.status).toBe(400);
  });

  test("seeds templates from embedded files when available", async () => {
    const runtime = Bun as unknown as { embeddedFiles: (Blob & { name: string })[] };
    const originalEmbeddedFiles = runtime.embeddedFiles;
    runtime.embeddedFiles = TEMPLATE_FILES.map((fileName) =>
      makeEmbeddedTemplateFile(fileName, `# embedded:${fileName}\n`),
    );

    try {
      const createRes = await app.request("/v1/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Embedded Template Project" }),
      });
      expect(createRes.status).toBe(201);

      const project = (await createRes.json()) as { id: string };
      const ticketRes = await app.request(`/v1/projects/${project.id}/templates/ticket`);
      expect(ticketRes.status).toBe(200);

      const ticketTemplate = (await ticketRes.json()) as { content: string };
      expect(ticketTemplate.content).toBe("# embedded:tickets/ticket.md\n");

      const bugFixRes = await app.request(`/v1/projects/${project.id}/templates/bug-fix`);
      expect(bugFixRes.status).toBe(200);

      const bugFixTemplate = (await bugFixRes.json()) as { content: string };
      expect(bugFixTemplate.content).toBe("# embedded:tickets/bug-fix.ticket.md\n");
    } finally {
      runtime.embeddedFiles = originalEmbeddedFiles;
    }
  });

  test("rolls back the project when seeding fails", async () => {
    const storagePath = join(tempRoot, "storage");
    const projectName = "Rollback Project";

    chmodSync(storagePath, 0o555);

    try {
      const createRes = await app.request("/v1/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: projectName }),
      });

      expect(createRes.status).toBe(500);
    } finally {
      chmodSync(storagePath, 0o755);
    }

    const listRes = await app.request("/v1/projects");
    expect(listRes.status).toBe(200);

    const projects = (await listRes.json()) as { name: string }[];
    expect(projects.some((project) => project.name === projectName)).toBe(false);
  });
});
