import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import type { OpenAPIHono } from "@hono/zod-openapi";
import type { AgentService, SessionMessage, SessionMessageInput, SessionStartInput } from "pstdio-agents";
import { createApp } from "../../../app";
import type { AppBindings } from "../../../types";

let app: OpenAPIHono<AppBindings>;
let tempRoot: string;

const startedInputs: SessionStartInput[] = [];
const resumedInputs: SessionMessageInput[] = [];

const createRecordingAgent = (): AgentService => {
  const getUserMessage = (
    sessionId: string,
    prompt: string,
    attachments: SessionStartInput["attachments"],
  ): SessionMessage => ({
    id: `${sessionId}-user`,
    role: "user",
    parts: [
      { type: "text", text: prompt },
      ...((attachments ?? []).map((attachment) => ({
        type: "attachment" as const,
        id: attachment.id,
        fileName: attachment.file_name,
        mimeType: attachment.mime_type,
        sizeBytes: attachment.size_bytes,
      })) ?? []),
    ],
  });

  const complete = (sessionId: string) => ({
    sessionId,
    stdin: new PassThrough(),
    kill: () => {},
    onExit: Promise.resolve({ code: 0, signal: null }),
  });

  return {
    id: "claude-code",
    name: "Claude Code",
    capabilities: () => [],
    checkAvailability: () => ({ type: "INSTALLED" }),
    listModels: () => [{ id: "sonnet" }],
    startSession: async (input) => {
      startedInputs.push(input);
      const sessionId = `agent-${crypto.randomUUID().slice(0, 8)}`;
      input.eventStore?.push({
        op: "add",
        path: "/messages/0",
        value: getUserMessage(sessionId, input.prompt, input.attachments),
      });
      input.eventStore?.push({
        op: "add",
        path: "/messages/1",
        value: { id: `${sessionId}-assistant`, role: "assistant", parts: [{ type: "text", text: "ok" }] },
      });
      return { sessionId, process: complete(sessionId) };
    },
    resumeSession: async (input, eventStore) => {
      resumedInputs.push(input);
      eventStore.push({
        op: "add",
        path: `/messages/${input.messageOffset ?? 0}`,
        value: getUserMessage(input.sessionId, input.prompt, input.attachments),
      });
      eventStore.push({
        op: "add",
        path: `/messages/${(input.messageOffset ?? 0) + 1}`,
        value: {
          id: `${input.sessionId}-assistant-follow-up`,
          role: "assistant",
          parts: [{ type: "text", text: "done" }],
        },
      });
      return { process: complete(input.sessionId) };
    },
    getMessages: async () => [],
    listSessions: async () => [],
    exportSession: async (sessionId) => ({
      session: { id: sessionId, title: sessionId, directory: process.cwd(), updatedAt: new Date().toISOString() },
      messages: [],
    }),
    launchSession: async () => ({}),
  };
};

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-session-attachments-test-"));

  ({ app } = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
    filesRoot: "",
    agents: [createRecordingAgent()],
  }));
});

afterAll(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

beforeEach(() => {
  startedInputs.length = 0;
  resumedInputs.length = 0;
});

describe("session attachment flow", () => {
  test("uploads an image attachment and sends it through create + follow-up", async () => {
    const projectRes = await app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Attachment Project" }),
    });
    expect(projectRes.status).toBe(201);
    const project = await projectRes.json();

    const uploadRes = await app.request("/v1/sessions/attachments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        project_id: project.id,
        file_name: "screen.png",
        mime_type: "image/png",
        content_base64: Buffer.from("fake-image-bytes").toString("base64"),
      }),
    });
    expect(uploadRes.status).toBe(201);
    const attachment = await uploadRes.json();
    expect(attachment.file_name).toBe("screen.png");

    const createRes = await app.request("/v1/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        project_id: project.id,
        title: "With image",
        prompt: "Describe the screenshot",
        agent: "claude-code",
        attachments: [attachment],
      }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const getRes = await app.request(`/v1/sessions/${created.id}`);
      const session = await getRes.json();
      if (session.status === "completed") {
        break;
      }
      await Bun.sleep(10);
    }

    const followUpRes = await app.request(`/v1/sessions/${created.id}/follow-up`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        prompt: "Now summarize it",
        attachments: [attachment],
      }),
    });
    expect(followUpRes.status).toBe(200);

    expect(startedInputs[0]?.attachments).toHaveLength(1);
    expect(startedInputs[0]?.attachments?.[0]).toMatchObject({
      id: attachment.id,
      file_name: "screen.png",
      mime_type: "image/png",
    });
    expect(startedInputs[0]?.attachments?.[0]?.data_base64).toBe(Buffer.from("fake-image-bytes").toString("base64"));

    expect(resumedInputs[0]?.attachments).toHaveLength(1);
    expect(resumedInputs[0]?.attachments?.[0]?.id).toBe(attachment.id);
  });

  test("rejects non-session-attachment file ids", async () => {
    const projectRes = await app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Ticket File Project" }),
    });
    expect(projectRes.status).toBe(201);
    const project = await projectRes.json();

    const ticketRes = await app.request("/v1/tickets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ project_id: project.id, user_prompt: "ticket" }),
    });
    expect(ticketRes.status).toBe(201);
    const ticket = await ticketRes.json();

    const ticketFileRes = await app.request(`/v1/tickets/${ticket.id}/files`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        file_name: "notes.md",
        mime_type: "text/markdown",
        content_base64: Buffer.from("# hello").toString("base64"),
      }),
    });
    expect(ticketFileRes.status).toBe(201);
    const ticketFile = await ticketFileRes.json();

    const createRes = await app.request("/v1/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        project_id: project.id,
        title: "Should fail",
        prompt: "Describe this",
        agent: "claude-code",
        attachments: [
          {
            id: ticketFile.id,
            file_name: ticketFile.file_name,
            mime_type: ticketFile.mime_type,
            size_bytes: ticketFile.size_bytes,
          },
        ],
      }),
    });

    expect(createRes.status).toBe(400);
    const body = await createRes.json();
    expect(body.error).toContain("not a session upload");
  });

  test("rejects metadata spoofing for create and follow-up attachments", async () => {
    const projectRes = await app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Spoof Project" }),
    });
    expect(projectRes.status).toBe(201);
    const project = await projectRes.json();

    const uploadRes = await app.request("/v1/sessions/attachments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        project_id: project.id,
        file_name: "image.webp",
        mime_type: "image/webp",
        content_base64: Buffer.from("real-image").toString("base64"),
      }),
    });
    expect(uploadRes.status).toBe(201);
    const attachment = await uploadRes.json();

    const createSpoofRes = await app.request("/v1/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        project_id: project.id,
        title: "Spoof create",
        prompt: "Describe",
        agent: "claude-code",
        attachments: [{ ...attachment, mime_type: "image/png" }],
      }),
    });
    expect(createSpoofRes.status).toBe(400);
    expect((await createSpoofRes.json()).error).toContain("metadata mismatch");

    const createRes = await app.request("/v1/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        project_id: project.id,
        title: "Valid create",
        prompt: "Describe",
        agent: "claude-code",
        attachments: [attachment],
      }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const getRes = await app.request(`/v1/sessions/${created.id}`);
      const session = await getRes.json();
      if (session.status === "completed") {
        break;
      }
      await Bun.sleep(10);
    }

    const followUpSpoofRes = await app.request(`/v1/sessions/${created.id}/follow-up`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        prompt: "Follow-up",
        attachments: [{ ...attachment, file_name: "fake-name.webp" }],
      }),
    });
    expect(followUpSpoofRes.status).toBe(400);
    expect((await followUpSpoofRes.json()).error).toContain("metadata mismatch");
  });
});
