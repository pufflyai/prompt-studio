import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import type { TicketsTestContext } from "./tickets-test-harness";
import { createTicketsTestContext } from "./tickets-test-harness";

let context!: TicketsTestContext;

beforeAll(async () => {
  context = await createTicketsTestContext();
});

afterAll(() => {
  context.cleanup();
});

const createTicket = async (body: Record<string, unknown> = {}) => {
  const { app, projectId } = context;
  const res = await app.request("/v1/tickets", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ project_id: projectId, ...body }),
  });

  expect(res.status).toBe(201);
  return res.json();
};

describe("GET /v1/tickets/:id", () => {
  test("returns ticket by id with canonical content", async () => {
    const content = "# Ticket body heading\n\nSome details";
    const created = await createTicket({ content });

    const { app } = context;
    const res = await app.request(`/v1/tickets/${created.id}`);
    expect(res.status).toBe(200);
    const ticket = await res.json();
    expect(ticket.id).toBe(created.id);
    expect(ticket.content).toBe(content);
  });

  test("returns empty content when ticket has no canonical file", async () => {
    const created = await createTicket();

    const { app } = context;
    const res = await app.request(`/v1/tickets/${created.id}`);
    expect(res.status).toBe(200);
    const ticket = await res.json();
    expect(ticket.content).toBe("");
  });

  test("returns 404 for non-existent ticket", async () => {
    const { app } = context;
    const res = await app.request("/v1/tickets/non-existent");
    expect(res.status).toBe(404);
  });

  test("returns empty content when storage file is missing from disk", async () => {
    const content = "# Orphaned file\n\nBody that will be deleted from disk.";
    const created = await createTicket({ content });
    expect(created.file_id).not.toBeNull();

    const { app, tempRoot } = context;
    const storagePath = join(tempRoot, "storage");
    const files = readdirSync(storagePath, { recursive: true }) as string[];
    const filePath = files
      .map((file) => join(storagePath, file))
      .find((filePath) => statSync(filePath).isFile() && readFileSync(filePath, "utf8") === content);
    expect(filePath).toBeDefined();
    unlinkSync(filePath!);

    const res = await app.request(`/v1/tickets/${created.id}`);
    expect(res.status).toBe(200);
    const ticket = await res.json();
    expect(ticket.content).toBe("");
  });
});
