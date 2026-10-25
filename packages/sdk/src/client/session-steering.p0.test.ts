import { expect, test } from "bun:test";
import { createClient } from "./client";

test("submits live input with its captured run and canonical attachments using authentication", async () => {
  const calls: unknown[] = [];
  const result = { status: "accepted" as const, deliveryId: "delivery" };
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      calls.push({
        path: new URL(request.url).pathname,
        body: await request.json(),
        authorization: request.headers.get("authorization"),
      });
      return Response.json(result);
    },
  });
  try {
    const client = createClient({ baseUrl: server.url.origin, token: "steering-test" });
    const input = { prompt: "Correction", expectedRunStartedAt: "run", attachments: [{ fileId: "file" }] };
    expect(await client.sessions.steer("session", input)).toEqual(result);
    expect(calls).toEqual([{ path: "/v1/sessions/session/steer", body: input, authorization: "Bearer steering-test" }]);
  } finally {
    server.stop(true);
  }
});

test("does not retry a failed live submission", async () => {
  let calls = 0;
  const server = Bun.serve({
    port: 0,
    fetch() {
      calls++;
      return Response.json({ error: "Lost acknowledgement" }, { status: 500 });
    },
  });
  try {
    const client = createClient({ baseUrl: server.url.origin });
    await expect(
      client.sessions.steer("session", { prompt: "Correction", expectedRunStartedAt: "run" }),
    ).rejects.toThrow();
    expect(calls).toBe(1);
  } finally {
    server.stop(true);
  }
});
