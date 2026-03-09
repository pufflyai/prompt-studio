import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { createApp } from "../../../app";
import type { AppBindings } from "../../../types";

let app: OpenAPIHono<AppBindings>;
let tempRoot: string;
let projectId: string;

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-tickets-test-"));
  ({ app } = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
  }));

  const res = await app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "test-project" }),
  });
  const project = await res.json();
  projectId = project.id;
});

afterAll(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("POST /v1/tickets", () => {
  test("returns 404 when project does not exist", async () => {
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
  });

  test("creates a draft ticket", async () => {
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
    const res = await app.request("/v1/tickets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ project_id: projectId, title: "Legacy title field" }),
    });

    expect(res.status).toBe(400);
  });

  test("rejects display_title field", async () => {
    const res = await app.request("/v1/tickets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ project_id: projectId, display_title: "Explicit title" }),
    });

    expect(res.status).toBe(400);
  });
});

describe("POST /v1/tickets with content", () => {
  test("derives display_title from content heading", async () => {
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

  test("rejects display_title even when content is provided", async () => {
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

describe("GET /v1/tickets", () => {
  test("lists non-draft tickets by default", async () => {
    const res = await app.request(`/v1/tickets?project_id=${projectId}`);

    expect(res.status).toBe(200);
    const tickets = await res.json();
    expect(tickets.length).toBeGreaterThanOrEqual(1);
    expect(tickets.every((t: { draft: boolean }) => !t.draft)).toBe(true);
    expect(tickets[0].status_name).toBeDefined();
    expect(tickets[0].tag_names).toBeDefined();
  });

  test("lists draft tickets when requested", async () => {
    const res = await app.request(`/v1/tickets?project_id=${projectId}&draft=true`);

    expect(res.status).toBe(200);
    const tickets = await res.json();
    expect(tickets.length).toBeGreaterThanOrEqual(1);
    expect(tickets.every((t: { draft: boolean }) => t.draft)).toBe(true);
  });

  test("filters by shorthand", async () => {
    const res = await app.request(`/v1/tickets?project_id=${projectId}&shorthand=TP-1`);

    expect(res.status).toBe(200);
    const tickets = await res.json();
    expect(tickets.length).toBe(1);
    expect(tickets[0].shorthand).toBe("TP-1");
  });

  test("filters by search term", async () => {
    await app.request("/v1/tickets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        project_id: projectId,
        content: "# Search only ticket\n\nContains a unique phrase",
        user_prompt: "investigate flaky search indexing",
      }),
    });

    const res = await app.request(`/v1/tickets?project_id=${projectId}&search=flaky search`);

    expect(res.status).toBe(200);
    const tickets = await res.json();
    expect(tickets.length).toBe(1);
    expect(tickets[0].user_prompt).toContain("flaky search indexing");
  });

  test("includes archived tickets in default list", async () => {
    const createRes = await app.request("/v1/tickets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ project_id: projectId, content: "Soon archived" }),
    });
    const created = await createRes.json();

    await app.request(`/v1/tickets/${created.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ archived: true }),
    });

    const allRes = await app.request(`/v1/tickets?project_id=${projectId}`);
    const all = await allRes.json();
    expect(all.some((t: { id: string }) => t.id === created.id)).toBe(true);

    const nonArchivedRes = await app.request(`/v1/tickets?project_id=${projectId}&archived=false`);
    const nonArchived = await nonArchivedRes.json();
    expect(nonArchived.some((t: { id: string }) => t.id === created.id)).toBe(false);

    const archivedRes = await app.request(`/v1/tickets?project_id=${projectId}&archived=true`);
    const archived = await archivedRes.json();
    expect(archived.some((t: { id: string }) => t.id === created.id)).toBe(true);
  });

  test("returns 400 when unknown query params are provided", async () => {
    const res = await app.request(`/v1/tickets?project_id=${projectId}&x=1`);

    expect(res.status).toBe(400);
  });
});

describe("GET /v1/tickets/:id", () => {
  test("returns ticket by id with canonical content", async () => {
    const content = "# Ticket body heading\n\nSome details";
    const createRes = await app.request("/v1/tickets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ project_id: projectId, content }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();

    const res = await app.request(`/v1/tickets/${created.id}`);
    expect(res.status).toBe(200);
    const ticket = await res.json();
    expect(ticket.id).toBe(created.id);
    expect(ticket.content).toBe(content);
  });

  test("returns empty content when ticket has no canonical file", async () => {
    const createRes = await app.request("/v1/tickets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ project_id: projectId }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();

    const res = await app.request(`/v1/tickets/${created.id}`);
    expect(res.status).toBe(200);
    const ticket = await res.json();
    expect(ticket.content).toBe("");
  });

  test("returns 404 for non-existent ticket", async () => {
    const res = await app.request("/v1/tickets/non-existent");
    expect(res.status).toBe(404);
  });

  test("returns empty content when storage file is missing from disk", async () => {
    const content = "# Orphaned file\n\nBody that will be deleted from disk.";
    const createRes = await app.request("/v1/tickets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ project_id: projectId, content }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.file_id).not.toBeNull();

    const storagePath = join(tempRoot, "storage");
    const files = require("node:fs").readdirSync(storagePath, { recursive: true }) as string[];
    const filePath = files
      .map((f: string) => join(storagePath, f))
      .find(
        (f: string) =>
          require("node:fs").statSync(f).isFile() && require("node:fs").readFileSync(f, "utf8") === content,
      );
    expect(filePath).toBeDefined();
    unlinkSync(filePath!);

    const res = await app.request(`/v1/tickets/${created.id}`);
    expect(res.status).toBe(200);
    const ticket = await res.json();
    expect(ticket.content).toBe("");
  });
});

describe("PATCH /v1/tickets/:id", () => {
  test("updates ticket display_title", async () => {
    const listRes = await app.request(`/v1/tickets?project_id=${projectId}`);
    const tickets = await listRes.json();
    const ticketId = tickets[0].id;

    const res = await app.request(`/v1/tickets/${ticketId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ display_title: "Updated title" }),
    });

    expect(res.status).toBe(200);
    const ticket = await res.json();
    expect(ticket.display_title).toBe("Updated title");
  });

  test("returns 404 for non-existent ticket", async () => {
    const res = await app.request("/v1/tickets/non-existent", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ display_title: "Nope" }),
    });
    expect(res.status).toBe(404);
  });

  test("updates canonical content file and derived display_title when content is provided", async () => {
    const createRes = await app.request("/v1/tickets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ project_id: projectId, content: "# Original title\n\nOriginal body" }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.file_id).not.toBeNull();

    const updatedContent = "# Updated title\n\nUpdated body";
    const updateRes = await app.request(`/v1/tickets/${created.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: updatedContent }),
    });

    expect(updateRes.status).toBe(200);
    const updated = await updateRes.json();
    expect(updated.display_title).toBe("Updated title");
    expect(updated.file_id).not.toBeNull();
    expect(updated.file_id).toBe(created.file_id);

    const fileRes = await app.request(`/v1/tickets/${created.id}/files/${updated.file_id}/content`);
    expect(fileRes.status).toBe(200);
    expect(await fileRes.text()).toBe(updatedContent);
  });
});

describe("ticket files", () => {
  test("uploads, lists, and downloads a ticket file", async () => {
    const ticketRes = await app.request("/v1/tickets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ project_id: projectId }),
    });
    expect(ticketRes.status).toBe(201);
    const ticket = await ticketRes.json();
    const ticketId = ticket.id as string;

    const uploadRes = await app.request(`/v1/tickets/${ticketId}/files`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        file_name: "notes.txt",
        content_base64: Buffer.from("hello from file", "utf8").toString("base64"),
        mime_type: "text/plain",
      }),
    });

    expect(uploadRes.status).toBe(201);
    const uploaded = await uploadRes.json();
    expect(uploaded.file_name).toBe("notes.txt");

    const filesRes = await app.request(`/v1/tickets/${ticketId}/files`);
    expect(filesRes.status).toBe(200);
    const files = await filesRes.json();
    expect(files.length).toBe(1);
    expect(files[0].id).toBe(uploaded.id);

    const contentRes = await app.request(`/v1/tickets/${ticketId}/files/${uploaded.id}/content`);
    expect(contentRes.status).toBe(200);
    expect(await contentRes.text()).toBe("hello from file");
  });

  test("updates file content when uploading same file_name", async () => {
    const ticketRes = await app.request("/v1/tickets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ project_id: projectId }),
    });
    expect(ticketRes.status).toBe(201);
    const ticket = await ticketRes.json();
    const ticketId = ticket.id as string;

    const firstUploadRes = await app.request(`/v1/tickets/${ticketId}/files`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        file_name: "same-name.txt",
        content_base64: Buffer.from("first", "utf8").toString("base64"),
      }),
    });
    expect(firstUploadRes.status).toBe(201);
    const firstFile = await firstUploadRes.json();

    const secondUploadRes = await app.request(`/v1/tickets/${ticketId}/files`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        file_name: "same-name.txt",
        content_base64: Buffer.from("second", "utf8").toString("base64"),
      }),
    });
    expect(secondUploadRes.status).toBe(200);
    const secondFile = await secondUploadRes.json();
    expect(secondFile.id).toBe(firstFile.id);

    const filesRes = await app.request(`/v1/tickets/${ticketId}/files`);
    expect(filesRes.status).toBe(200);
    const files = await filesRes.json();
    expect(files.filter((file: { file_name: string }) => file.file_name === "same-name.txt").length).toBe(1);

    const contentRes = await app.request(`/v1/tickets/${ticketId}/files/${firstFile.id}/content`);
    expect(contentRes.status).toBe(200);
    expect(await contentRes.text()).toBe("second");
  });
});

describe("GET /v1/projects/:projectId/ticket-tags", () => {
  test("returns tags for project", async () => {
    const res = await app.request(`/v1/projects/${projectId}/ticket-tags`);

    expect(res.status).toBe(200);
    const tags = await res.json();
    expect(tags.length).toBeGreaterThanOrEqual(3);
    expect(tags.map((t: { name: string }) => t.name)).toContain("bug");
  });
});

describe("GET /v1/projects/:projectId/ticket-statuses", () => {
  test("returns statuses for project", async () => {
    const res = await app.request(`/v1/projects/${projectId}/ticket-statuses`);

    expect(res.status).toBe(200);
    const statuses = await res.json();
    expect(statuses.length).toBeGreaterThanOrEqual(6);
    expect(statuses.map((s: { name: string }) => s.name)).toContain("backlog");
    expect(statuses.map((s: { name: string }) => s.name)).toContain("wip");
  });
});
