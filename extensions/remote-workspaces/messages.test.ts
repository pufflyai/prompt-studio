import { expect, test } from "bun:test";
import { getMessages } from "./messages";
import { startPocketCoderTestServer, workspaceId, workspaceResource } from "./pocketcoder-test-server";

test("reads all durable conversation pages after the workspace has stopped", async () => {
  const server = startPocketCoderTestServer((request) => {
    const url = new URL(request.url);
    if (!url.pathname.endsWith("/conversation")) return Response.json(workspaceResource("canceled"));
    const second = url.searchParams.has("cursor");
    return Response.json({
      items: [
        {
          message_id: second ? "reply" : "prompt",
          seq: second ? 2 : 1,
          role: second ? "assistant" : "user",
          content: second ? "Done" : "Work",
          occurred_at: "2026-09-08T07:00:00.000Z",
        },
      ],
      next_cursor: second ? null : "opaque+/cursor",
      retention: { status: "retained", expires_at: null },
    });
  });
  try {
    const messages = await getMessages(server.ctx, workspaceId);
    expect(messages.map(({ role, parts }) => ({ role, parts }))).toEqual([
      { role: "user", parts: [{ type: "text", text: "Work" }] },
      { role: "assistant", parts: [{ type: "text", text: "Done" }] },
    ]);
    expect(messages[1]).toMatchObject({ createdAt: Date.parse("2026-09-08T07:00:00.000Z") });
  } finally {
    server.stop();
  }
});
