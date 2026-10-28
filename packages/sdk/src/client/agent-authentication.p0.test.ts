import { expect, test } from "bun:test";
import { authenticateAgent } from "./agent-authentication";

test("interactive account replies use the authenticated socket without HTTP commands", async () => {
  const frames: unknown[] = [];
  let credential: string | null = null;
  const server = Bun.serve({
    port: 0,
    fetch(req, server) {
      credential = req.headers.get("sec-websocket-protocol");
      if (server.upgrade(req, { headers: { "sec-websocket-protocol": "pstdio" } })) return;
      return new Response(null, { status: 400 });
    },
    websocket: {
      message(socket, raw) {
        const frame = JSON.parse(String(raw));
        frames.push(frame);
        if (frame.type === "open")
          socket.send(
            JSON.stringify({
              type: "prompt",
              requestId: "key",
              prompt: { type: "input", title: "API key", secret: true },
            }),
          );
        else {
          socket.send(JSON.stringify({ type: "completed" }));
          socket.close();
        }
      },
    },
  });
  try {
    await authenticateAgent(
      { baseUrl: server.url.href.replace(/\/$/, ""), token: "runtime-secret" },
      "example",
      { action: "login" },
      { projectId: "project", onRequest: async () => "private-key" },
    );
    expect(String(credential)).toContain("pstdio.bearer.runtime-secret");
    expect(frames).toEqual([
      { type: "open", agent: "example", projectId: "project", input: { action: "login" } },
      { type: "reply", requestId: "key", value: "private-key" },
    ]);
  } finally {
    server.stop(true);
  }
});
