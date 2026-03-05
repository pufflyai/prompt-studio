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
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-tickets-test-"));
  app = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
  });

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
  test("creates a ticket", async () => {
    const res = await app.request("/v1/tickets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ project_id: projectId, title: "First ticket" }),
    });

    expect(res.status).toBe(201);
    const ticket = await res.json();
    expect(ticket.shorthand).toBe("TP-1");
    expect(ticket.title).toBe("First ticket");
    expect(ticket.draft).toBe(false);
  });

  test("creates a draft ticket", async () => {
    const res = await app.request("/v1/tickets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ project_id: projectId, title: "Draft ticket", draft: true }),
    });

    expect(res.status).toBe(201);
    const ticket = await res.json();
    expect(ticket.draft).toBe(true);
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
});

describe("GET /v1/tickets/:id", () => {
  test("returns ticket by id", async () => {
    const listRes = await app.request(`/v1/tickets?project_id=${projectId}`);
    const tickets = await listRes.json();
    const ticketId = tickets[0].id;

    const res = await app.request(`/v1/tickets/${ticketId}`);
    expect(res.status).toBe(200);
    const ticket = await res.json();
    expect(ticket.id).toBe(ticketId);
  });

  test("returns 404 for non-existent ticket", async () => {
    const res = await app.request("/v1/tickets/non-existent");
    expect(res.status).toBe(404);
  });
});

describe("PATCH /v1/tickets/:id", () => {
  test("updates ticket title", async () => {
    const listRes = await app.request(`/v1/tickets?project_id=${projectId}`);
    const tickets = await listRes.json();
    const ticketId = tickets[0].id;

    const res = await app.request(`/v1/tickets/${ticketId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Updated title" }),
    });

    expect(res.status).toBe(200);
    const ticket = await res.json();
    expect(ticket.title).toBe("Updated title");
  });

  test("returns 404 for non-existent ticket", async () => {
    const res = await app.request("/v1/tickets/non-existent", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Nope" }),
    });
    expect(res.status).toBe(404);
  });
});

describe("ticket files", () => {
  test("uploads, lists, and downloads a ticket file", async () => {
    const listRes = await app.request(`/v1/tickets?project_id=${projectId}`);
    const tickets = await listRes.json();
    const ticketId = tickets[0].id as string;

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
    const listRes = await app.request(`/v1/tickets?project_id=${projectId}`);
    const tickets = await listRes.json();
    const ticketId = tickets[0].id as string;

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
