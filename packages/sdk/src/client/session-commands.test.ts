import { expect, test } from "bun:test";
import { createClient } from "./client";

test("session command discovery and invocation preserve native input and authentication", async () => {
  const calls: Array<{ path: string; authorization: string | null; body?: unknown }> = [];
  const server = Bun.serve({
    port: 0,
    fetch: async (request) => {
      const path = new URL(request.url).pathname;
      calls.push({
        path,
        authorization: request.headers.get("authorization"),
        ...(request.method === "POST" ? { body: await request.json() } : {}),
      });
      return Response.json(
        request.method === "GET" || path === "/v1/sessions/harness-command-state"
          ? { harnessId: "test.native.harness.agent", slashCommands: true, commands: [], modes: [] }
          : { status: "completed", message: "native outcome" },
      );
    },
  });
  try {
    const client = createClient({ baseUrl: server.url.origin, token: "test-token" });
    expect((await client.sessions.getHarnessCommands("one")).harnessId).toBe("test.native.harness.agent");
    const draft = {
      project_id: "project",
      agent: "test.native.harness.agent",
      workspace_id: "workspace",
      model: "model",
      params: { planning: true },
    };
    expect((await client.sessions.getDraftHarnessCommands(draft)).slashCommands).toBe(true);
    expect(
      await client.sessions.invokeHarnessOperation(
        "one",
        { kind: "command", text: "/goal  raw native argument" },
        "test.native.harness.agent",
      ),
    ).toMatchObject({ status: "completed", message: "native outcome" });
    expect(calls).toEqual([
      { path: "/v1/sessions/one/harness-commands", authorization: "Bearer test-token" },
      { path: "/v1/sessions/harness-command-state", authorization: "Bearer test-token", body: draft },
      {
        path: "/v1/sessions/one/harness-commands",
        authorization: "Bearer test-token",
        body: {
          operation: { kind: "command", text: "/goal  raw native argument" },
          harnessId: "test.native.harness.agent",
        },
      },
    ]);
  } finally {
    server.stop(true);
  }
});
