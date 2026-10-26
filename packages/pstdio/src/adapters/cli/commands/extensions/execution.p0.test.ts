import { expect, test } from "bun:test";
import { createClient } from "@pstdio/sdk/client";
import { createHandler } from "./execution";

test("shared execution control requires explicit scope before sending a mutating request", async () => {
  const actions: string[] = [];
  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch: async (request) => {
      if (request.method === "POST") actions.push((await request.json()).action);
      return Response.json({
        available: true,
        stopped: actions.at(-1) === "stop",
        owners: [],
        affectedProjects: [
          { id: "first", name: "First" },
          { id: "second", name: "Second" },
        ],
      });
    },
  });
  const messages: string[] = [];
  const handler = createHandler({
    execution: () => createClient({ baseUrl: server.url.href }).extensions.execution,
    log: (value) => messages.push(value),
    warn: (value) => messages.push(value),
  });
  const argv = { _: [], $0: "pst", action: "stop" as const, instance: "source", "project-id": "first" };
  try {
    await expect(handler(argv)).rejects.toThrow("--shared");
    expect(actions).toEqual([]);
    expect(messages[0]).toContain("First, Second");
    await handler({ ...argv, shared: true });
    expect(actions).toEqual(["stop"]);
    expect(JSON.parse(messages.at(-1)!)).toMatchObject({ stopped: true });
    await handler({ ...argv, action: "restart", shared: true });
    expect(actions).toEqual(["stop", "restart"]);
  } finally {
    server.stop(true);
  }
});
