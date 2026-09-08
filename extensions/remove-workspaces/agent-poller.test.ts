import { expect, test } from "bun:test";
import type { SessionMessage } from "@pstdio/sdk/extensions";
import { pollAgent } from "./agent-poller";
import { startPocketCoderTestServer, workspaceId, workspaceResource } from "./pocketcoder-test-server";

test("updates a mutable agent response and fetches its final content after stable status", async () => {
  let messageReads = 0;
  const server = startPocketCoderTestServer((request) => {
    const path = new URL(request.url).pathname;
    if (path.endsWith("/agent/messages")) {
      messageReads += 1;
      return Response.json({
        messages: [
          { id: 0, role: "user", content: "Work" },
          { id: 1, role: "agent", content: messageReads >= 3 ? "Finished" : "Working" },
        ],
      });
    }
    if (path.endsWith("/agent/status")) return Response.json({ status: messageReads >= 2 ? "stable" : "running" });
    return Response.json(workspaceResource());
  });
  try {
    expect(
      await pollAgent({
        ctx: server.ctx,
        id: workspaceId,
        baseline: 0,
        events: server.events,
        signal: new AbortController().signal,
      }),
    ).toEqual({ status: "completed" });
    const snapshots = server.patches.map(({ value }) => value as SessionMessage[]);
    expect(snapshots.map((messages) => messages[1]?.parts[0])).toEqual([
      { type: "text", text: "Working" },
      { type: "text", text: "Finished" },
    ]);
  } finally {
    server.stop();
  }
});

test("does not finish a follow-up from an earlier assistant response", async () => {
  const controller = new AbortController();
  let seenStatus = false;
  const server = startPocketCoderTestServer((request) => {
    const path = new URL(request.url).pathname;
    if (path.endsWith("/agent/messages"))
      return Response.json({
        messages: [
          { id: 0, role: "user", content: "First" },
          { id: 1, role: "agent", content: "Old reply" },
        ],
      });
    if (path.endsWith("/agent/status")) {
      seenStatus = true;
      return Response.json({ status: "stable" });
    }
    if (seenStatus) controller.abort();
    return Response.json(workspaceResource());
  });
  try {
    await expect(
      pollAgent({ ctx: server.ctx, id: workspaceId, baseline: 1, events: server.events, signal: controller.signal }),
    ).rejects.toThrow();
  } finally {
    server.stop();
  }
});
