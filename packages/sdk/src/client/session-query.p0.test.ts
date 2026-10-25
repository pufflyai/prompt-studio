import { expect, test } from "bun:test";
import { createClient } from "./client";

test("session query and iteration carry activity order and qualified anchors through HTTP", async () => {
  const queries: Record<string, string>[] = [];
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      const query = new URL(request.url).searchParams;
      queries.push(Object.fromEntries(query));
      return Response.json({ items: [], nextCursor: query.has("cursor") ? null : "next-page" });
    },
  });
  try {
    const client = createClient({ baseUrl: server.url.toString() });
    const input = {
      orderBy: "lastActivity" as const,
      anchor: { type: "ticket", id: "one/#?", extensionId: "acme.planner", projectId: "project" },
    };
    await client.sessions.query("project", input);
    for await (const _session of client.sessions.iterate("project", input)) {
      throw new Error("The server returns no sessions");
    }
    const expected = {
      orderBy: "lastActivity",
      anchorType: "ticket",
      anchorId: "one/#?",
      anchorExtensionId: "acme.planner",
      anchorProjectId: "project",
    };
    expect(queries).toEqual([expected, expected, { ...expected, cursor: "next-page" }]);
  } finally {
    server.stop(true);
  }
});
