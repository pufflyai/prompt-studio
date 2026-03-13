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

describe("POST /v1/tickets/:id/files", () => {
  test("uploads a ticket file", async () => {
    const { app } = context;
    const ticket = await createTicket();

    const uploadRes = await app.request(`/v1/tickets/${ticket.id}/files`, {
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
  });

  test("updates file content when uploading same file_name", async () => {
    const { app } = context;
    const ticket = await createTicket();

    const firstUploadRes = await app.request(`/v1/tickets/${ticket.id}/files`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        file_name: "same-name.txt",
        content_base64: Buffer.from("first", "utf8").toString("base64"),
      }),
    });
    expect(firstUploadRes.status).toBe(201);
    const firstFile = await firstUploadRes.json();

    const secondUploadRes = await app.request(`/v1/tickets/${ticket.id}/files`, {
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

    const contentRes = await app.request(`/v1/tickets/${ticket.id}/files/${firstFile.id}/content`);
    expect(contentRes.status).toBe(200);
    expect(await contentRes.text()).toBe("second");
  });
});
