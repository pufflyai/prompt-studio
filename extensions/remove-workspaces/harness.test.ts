import { afterEach, describe, expect, test } from "bun:test";
import extension from "./extension";
import { remoteWorkspace, startPocketCoderTestServer, workspaceId, workspaceResource } from "./pocketcoder-test-server";

const harness = extension.harnesses![0]!;
const servers: ReturnType<typeof startPocketCoderTestServer>[] = [];
afterEach(() => {
  for (const server of servers.splice(0)) server.stop();
});

const agent = (
  options: {
    ambiguous?: boolean;
    pending?: boolean;
    cancelFailure?: boolean;
    disconnectOnSubmit?: boolean;
    unavailable?: boolean;
  } = {},
) => {
  const messages: { id: number; role: string; content: string }[] = [];
  let state = "ready";
  const submit = async (request: Request) => {
    if (options.disconnectOnSubmit) {
      options.unavailable = true;
      return Response.json({}, { status: 502 });
    }
    const body = (await request.json()) as { type: string; content: string };
    messages.push({ id: messages.length, role: body.type, content: body.content });
    if (!options.pending) messages.push({ id: messages.length, role: "agent", content: `Reply to ${body.content}` });
    return Response.json({}, { status: options.ambiguous ? 502 : 200 });
  };
  const server = startPocketCoderTestServer(async (request) => {
    if (options.unavailable) return Response.json({}, { status: 503 });
    const path = new URL(request.url).pathname;
    if (path.endsWith("/agent/message")) return submit(request);
    if (path.endsWith("/agent/messages")) return Response.json({ messages });
    if (path.endsWith("/agent/status")) return Response.json({ status: options.pending ? "running" : "stable" });
    if (path.endsWith("/cancel")) {
      if (options.cancelFailure) return Response.json({ error: { message: "Cancel unavailable" } }, { status: 503 });
      state = "canceled";
    }
    if (path === `/v1/workspaces/${workspaceId}` || path.endsWith("/cancel"))
      return Response.json(workspaceResource(state));
    return Response.json({ error: { message: "Unsupported endpoint" } }, { status: 404 });
  });
  servers.push(server);
  return {
    ...server,
    messages,
    input: { sessionId: "host-session", workspace: remoteWorkspace, prompt: "Hello", events: server.events },
  };
};

describe("PocketCoder agent turns", () => {
  test("sends through AgentAPI and maps the complete conversation", async () => {
    const server = agent();
    const session = await harness.start(server.ctx, server.input);
    expect(session.agentSessionId).toBe(workspaceId);
    expect(await session.done).toEqual({ status: "completed" });
    expect(server.requests.find(({ method }) => method === "POST")).toMatchObject({
      path: `/v1/workspaces/${workspaceId}/agent/message`,
      body: { content: "Hello", type: "user" },
    });
    expect(server.patches.filter(({ path }) => path === "/messages").at(-1)?.value).toMatchObject([
      { role: "user", parts: [{ type: "text", text: "Hello" }] },
      { role: "assistant", parts: [{ type: "text", text: "Reply to Hello" }] },
    ]);
  });

  test("keeps earlier turns on follow-up and replaces transcript snapshots", async () => {
    const server = agent();
    await (await harness.start(server.ctx, server.input)).done;
    const session = await harness.resume(server.ctx, {
      ...server.input,
      agentSessionId: workspaceId,
      prompt: "Continue",
      messageOffset: 2,
    });
    expect(await session.done).toEqual({ status: "completed" });
    expect(server.patches.filter(({ path }) => path === "/messages").at(-1)?.value).toHaveLength(4);
    expect(
      await harness.getMessages!(server.ctx, { agentSessionId: workspaceId, workspace: remoteWorkspace }),
    ).toHaveLength(4);
  });

  test("reads an ambiguously accepted prompt without submitting it again", async () => {
    const server = agent({ ambiguous: true });
    const session = await harness.start(server.ctx, server.input);
    expect(session.agentSessionId).toBe(workspaceId);
    expect(await session.done).toEqual({ status: "completed" });
    expect(server.requests.filter(({ method }) => method === "POST")).toHaveLength(1);
  });

  test("recovers a lost follow-up without treating the previous reply as its result", async () => {
    const options = { disconnectOnSubmit: false, unavailable: false };
    const server = agent(options);
    await (await harness.start(server.ctx, server.input)).done;
    options.disconnectOnSubmit = true;
    const followUp = await harness.resume(server.ctx, {
      ...server.input,
      prompt: "Continue",
      agentSessionId: workspaceId,
    });
    expect(await followUp.done).toEqual({ status: "disconnected" });
    options.unavailable = false;
    options.disconnectOnSubmit = false;
    const controller = new AbortController();
    const attached = await harness.reattach!(server.ctx, {
      ...server.input,
      agentSessionId: workspaceId,
      signal: controller.signal,
    });
    const timeout = setTimeout(() => controller.abort(), 100);
    try {
      expect(await attached.done).toEqual({ status: "disconnected" });
      expect(server.requests.filter(({ path }) => path.endsWith("/agent/message"))).toHaveLength(2);
    } finally {
      clearTimeout(timeout);
      controller.abort();
    }
    server.messages.push({ id: 2, role: "user", content: "Continue" }, { id: 3, role: "agent", content: "New reply" });
    const recovered = await harness.reattach!(server.ctx, { ...server.input, agentSessionId: workspaceId });
    expect(await recovered.done).toEqual({ status: "completed" });
    expect(server.requests.filter(({ path }) => path.endsWith("/agent/message"))).toHaveLength(2);
  });

  test("cancels the PocketCoder workspace when stopped", async () => {
    const server = agent({ pending: true });
    const session = await harness.start(server.ctx, server.input);
    await session.stop();
    expect(await session.done).toEqual({ status: "cancelled" });
    expect(server.requests).toContainEqual(
      expect.objectContaining({ method: "POST", path: `/v1/workspaces/${workspaceId}/cancel` }),
    );
  });

  test("stops polling and reports failed remote cancellation", async () => {
    const server = agent({ pending: true, cancelFailure: true });
    const session = await harness.start(server.ctx, server.input);
    await expect(session.stop()).rejects.toThrow("Cancel unavailable");
    expect(await session.done).toEqual({ status: "disconnected" });
  });

  test("rejects a session ID from another workspace before contacting the service", async () => {
    const server = agent();
    await expect(harness.resume(server.ctx, { ...server.input, agentSessionId: "another-workspace" })).rejects.toThrow(
      "workspace",
    );
    expect(server.requests).toHaveLength(0);
  });

  test("reports unsupported attachments before sending the prompt", async () => {
    const server = agent();
    await expect(
      harness.start(server.ctx, {
        ...server.input,
        attachments: [
          {
            fileId: "file",
            fileName: "file.txt",
            localPath: "/file.txt",
            url: "/file",
            mimeType: "text/plain",
            sizeBytes: 1,
          },
        ],
      }),
    ).rejects.toThrow("attachments");
    expect(server.requests).toHaveLength(0);
  });
});
