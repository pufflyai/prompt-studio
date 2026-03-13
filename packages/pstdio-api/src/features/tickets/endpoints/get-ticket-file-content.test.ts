import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { TicketsTestContext } from "./tickets-test-harness";
import { createTicketsTestContext } from "./tickets-test-harness";

let context!: TicketsTestContext;

beforeAll(async () => {
  context = await createTicketsTestContext();
});

afterAll(() => {
  context.cleanup();
});

const createTicket = async () => {
  const { app, projectId } = context;
  const ticketRes = await app.request("/v1/tickets", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ project_id: projectId }),
  });

  expect(ticketRes.status).toBe(201);
  return ticketRes.json();
};

describe("GET /v1/tickets/:id/files/:fileId/content", () => {
  test("returns uploaded file content", async () => {
    const { app } = context;
    const ticket = await createTicket();

    const uploadRes = await app.request(`/v1/tickets/${ticket.id}/files`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        file_name: "notes.txt",
        content_base64: Buffer.from("hello from file", "utf8").toString("base64"),
      }),
    });
    expect(uploadRes.status).toBe(201);
    const uploaded = await uploadRes.json();

    const contentRes = await app.request(`/v1/tickets/${ticket.id}/files/${uploaded.id}/content`);
    expect(contentRes.status).toBe(200);
    expect(await contentRes.text()).toBe("hello from file");
  });
});
