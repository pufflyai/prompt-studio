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

  test("emits sync events for the new file and ticket attachment", async () => {
    const { app, eventBus } = context;
    const ticket = await createTicket();
    const baselineSeq = eventBus.seq;

    const uploadRes = await app.request(`/v1/tickets/${ticket.id}/files`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        file_name: "sync-notes.txt",
        content_base64: Buffer.from("hello from sync", "utf8").toString("base64"),
        mime_type: "text/plain",
      }),
    });

    expect(uploadRes.status).toBe(201);

    const events = eventBus.getSince(baselineSeq);
    const fileEvent = events.find((event) => event.table === "files" && event.op === "set");
    const ticketFileEvent = events.find((event) => event.table === "ticket_files" && event.op === "set");

    expect(fileEvent).toBeDefined();
    expect(ticketFileEvent).toBeDefined();
    expect((fileEvent?.data as { file_name: string }).file_name).toBe("sync-notes.txt");
    expect((ticketFileEvent?.data as { ticket_id: string }).ticket_id).toBe(ticket.id);
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

  test("creates workspace artifact records when relative_path is provided", async () => {
    const { app, deps } = context;
    const ticket = await createTicket();

    const uploadRes = await app.request(`/v1/tickets/${ticket.id}/files`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        file_name: "validate.log",
        relative_path: "artifacts/validate.log",
        content_base64: Buffer.from("first run", "utf8").toString("base64"),
        mime_type: "text/plain",
      }),
    });

    expect(uploadRes.status).toBe(201);
    const uploaded = await uploadRes.json();

    const state = (await deps.syncService.getFullState()) as {
      files: Array<{ id: string; file_kind: string }>;
      workspace_artifacts: Array<{ id: string; ticket_id: string; file_id: string; relative_path: string }>;
    };

    const ticketArtifacts = state.workspace_artifacts.filter((artifact) => artifact.ticket_id === ticket.id);
    expect(ticketArtifacts).toHaveLength(1);
    expect(ticketArtifacts[0]).toEqual(
      expect.objectContaining({
        ticket_id: ticket.id,
        file_id: uploaded.id,
        relative_path: "artifacts/validate.log",
      }),
    );
    expect(state.files.find((file) => file.id === uploaded.id)?.file_kind).toBe("artifact");
  });

  test("re-uploading the same relative_path updates existing workspace artifact", async () => {
    const { app, deps, eventBus } = context;
    const ticket = await createTicket();

    const firstUploadRes = await app.request(`/v1/tickets/${ticket.id}/files`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        file_name: "validate.log",
        relative_path: "artifacts/validate.log",
        content_base64: Buffer.from("first run", "utf8").toString("base64"),
      }),
    });
    expect(firstUploadRes.status).toBe(201);
    const firstUploaded = await firstUploadRes.json();

    const baselineSeq = eventBus.seq;
    const secondUploadRes = await app.request(`/v1/tickets/${ticket.id}/files`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        file_name: "new-name.log",
        relative_path: "artifacts/validate.log",
        content_base64: Buffer.from("second run", "utf8").toString("base64"),
      }),
    });
    expect(secondUploadRes.status).toBe(200);

    const state = (await deps.syncService.getFullState()) as {
      files: Array<{ id: string; file_name: string }>;
      workspace_artifacts: Array<{ id: string; ticket_id: string; file_id: string; relative_path: string }>;
    };

    const ticketArtifacts = state.workspace_artifacts.filter((artifact) => artifact.ticket_id === ticket.id);
    expect(ticketArtifacts).toHaveLength(1);
    const artifact = ticketArtifacts[0];
    expect(artifact.ticket_id).toBe(ticket.id);
    expect(artifact.relative_path).toBe("artifacts/validate.log");
    expect(artifact.file_id).toBe(firstUploaded.id);
    expect(state.files.find((file) => file.id === artifact.file_id)).toBeDefined();

    const events = eventBus.getSince(baselineSeq);
    const artifactEvent = events.find((event) => event.table === "workspace_artifacts" && event.op === "set");
    expect(artifactEvent).toBeDefined();

    const contentRes = await app.request(`/v1/tickets/${ticket.id}/files/${artifact.file_id}/content`);
    expect(contentRes.status).toBe(200);
    expect(await contentRes.text()).toBe("second run");
  });
});
