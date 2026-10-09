import { expect, test } from "bun:test";
import { createClient } from "./client";

test("queue operations carry revisions and complete execution settings with authentication", async () => {
  const calls: Array<{ path: string; body: unknown; authorization: string | null }> = [];
  const server = Bun.serve({
    port: 0,
    fetch: async (request) => {
      calls.push({
        path: new URL(request.url).pathname,
        body: request.method === "GET" ? null : await request.json(),
        authorization: request.headers.get("authorization"),
      });
      return Response.json({ ok: true, requests: [] });
    },
  });
  try {
    const client = createClient({ baseUrl: server.url.origin, token: "queue-test" });
    await client.sessions.getQueuedFollowUps("session");
    const update = {
      prompt: "Updated",
      expectedRevision: "revision",
      model: "model",
      params: { thinking: "high" },
      attachments: [],
    };
    await client.sessions.updateQueuedFollowUp("session", 2, update);
    const combine = { sourcePosition: 1, sourceRevision: "source", targetRevision: "target" };
    await client.sessions.combineQueuedFollowUps("session", 2, combine);
    const steer = { expectedRevision: "revision", expectedRunStartedAt: "run" };
    await client.sessions.steerQueuedFollowUp("session", 2, steer);
    expect(calls).toEqual([
      { path: "/v1/sessions/session/queued-follow-ups", body: null, authorization: "Bearer queue-test" },
      { path: "/v1/sessions/session/queued-follow-ups/2", body: update, authorization: "Bearer queue-test" },
      { path: "/v1/sessions/session/queued-follow-ups/2/combine", body: combine, authorization: "Bearer queue-test" },
      { path: "/v1/sessions/session/queued-follow-ups/2/steer", body: steer, authorization: "Bearer queue-test" },
    ]);
  } finally {
    server.stop(true);
  }
});
