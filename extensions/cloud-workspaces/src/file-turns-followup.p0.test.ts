import { expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import type { InputObjectReference, WorkspaceRequest } from "@pstdio/pocketcoder-sdk";
import { reconnectFileTurn, resumeFileTurn } from "./file-turns";
import { fileTurnFixture } from "./file-turns.test-fixture";

async function pendingTurn() {
  const bodies: WorkspaceRequest[] = [];
  const uploaded: string[] = [];
  let uploadedReference: InputObjectReference | undefined;
  const f = await fileTurnFixture(async (req) => {
    if (req.method === "PUT") {
      uploaded.push(await req.text());
      return Response.json(uploadedReference);
    }
    if (req.method === "POST") {
      bodies.push((await req.json()) as WorkspaceRequest);
      return Response.json({});
    }
    return Response.json({
      phase: "terminal",
      finalizedAt: new Date().toISOString(),
      outcome: { status: "completed" },
    });
  });
  const conversationId = randomUUID();
  const request: WorkspaceRequest = {
    requestId: randomUUID(),
    conversationId,
    message: "hello",
    files: [
      {
        workspaceId: f.ref.machineId,
        fileId: randomUUID(),
        objectVersion: "old-version",
        name: "old.txt",
        mediaType: "text/plain",
        sizeBytes: 3,
        digest: "a".repeat(64),
        visibility: "ready",
      },
    ],
  };
  await f.state.set(`file-turn:${f.input.sessionId}`, { target: f.ref.sessionId, request });
  const text = "new attachment contents";
  const fileId = randomUUID();
  const localPath = join(f.root, "new.txt");
  await Bun.write(localPath, text);
  uploadedReference = {
    workspaceId: f.ref.machineId,
    fileId,
    objectVersion: "new-version",
    name: "new.txt",
    mediaType: "text/plain",
    sizeBytes: text.length,
    digest: new Bun.CryptoHasher("sha256").update(text).digest("hex"),
    visibility: "ready",
  };
  return {
    ...f,
    bodies,
    uploaded,
    uploadedReference,
    text,
    request,
    input: { ...f.input, agentSessionId: `${f.ref.sessionId}:${conversationId}` },
    attachment: {
      fileId,
      fileName: "new.txt",
      mimeType: "text/plain",
      sizeBytes: text.length,
      localPath,
      url: "https://files.example/new.txt",
    },
  };
}

test.each(["", "   ", "hello"])("pending recovery sends a new file follow-up with prompt %j", async (prompt) => {
  const f = await pendingTurn();
  try {
    const session = await resumeFileTurn(f.ctx, { ...f.input, prompt, attachments: [f.attachment] }, f.ref);
    expect(await session.done).toEqual({ status: "completed" });
    expect(f.uploaded).toEqual([f.text]);
    expect(f.bodies).toHaveLength(2);
    expect(f.bodies[0]).toEqual(f.request);
    expect(f.bodies[1]).toMatchObject({
      conversationId: f.request.conversationId,
      message: prompt || "Read the attached files.",
      files: [f.uploadedReference],
    });
    expect(f.bodies[1]?.requestId).not.toBe(f.request.requestId);
    expect(await f.state.get(`file-presentation:${f.request.conversationId}:${f.attachment.fileId}`)).toMatchObject({
      url: f.attachment.url,
    });
    expect(await f.state.get(`file-turn:${f.input.sessionId}`)).toBeUndefined();
  } finally {
    await f.close();
  }
});

test("a new repeated-text submission is distinct from recovering the saved request", async () => {
  const f = await pendingTurn();
  try {
    const session = await resumeFileTurn(f.ctx, { ...f.input, prompt: f.request.message }, f.ref);
    expect(await session.done).toEqual({ status: "completed" });
    expect(f.uploaded).toEqual([]);
    expect(f.bodies).toHaveLength(2);
    expect(f.bodies[0]).toEqual(f.request);
    expect(f.bodies[1]).toMatchObject({ conversationId: f.request.conversationId, message: "hello", files: [] });
    expect(f.bodies[1]?.requestId).not.toBe(f.request.requestId);
  } finally {
    await f.close();
  }
});

test.each([
  { prompt: "", attachments: undefined },
  { prompt: "   ", attachments: [] },
])("a no-content recovery only replays the saved request (%j)", async ({ prompt, attachments }) => {
  const f = await pendingTurn();
  try {
    const session = await resumeFileTurn(
      f.ctx,
      { ...f.input, prompt, attachments: attachments ? [...attachments] : undefined },
      f.ref,
    );
    expect(await session.done).toEqual({ status: "completed" });
    expect(f.uploaded).toEqual([]);
    expect(f.bodies).toEqual([f.request]);
  } finally {
    await f.close();
  }
});

test("reattachment recovers the accepted request without creating a new submission", async () => {
  const f = await pendingTurn();
  try {
    const session = await reconnectFileTurn(
      f.ctx,
      {
        sessionId: f.input.sessionId,
        agentSessionId: f.input.agentSessionId,
        events: f.input.events,
        signal: f.input.signal,
      },
      f.ref,
    );
    expect(await session?.done).toEqual({ status: "completed" });
    expect(f.uploaded).toEqual([]);
    expect(f.bodies).toEqual([f.request]);
  } finally {
    await f.close();
  }
});
