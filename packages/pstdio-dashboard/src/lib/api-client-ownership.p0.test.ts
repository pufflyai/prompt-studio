import { expect, test } from "bun:test";
import { getDashboardWorkspaceDiffQuery } from "@/shared/workspaces/workspace-diff-summary-data";
import { getDashboardAccountStatusQuery } from "./scoped-queries";
import { createRuntimeCollections } from "./sync/collections";

test("interleaved runtimes retain one physical stream for all of a runtime's diff observations", async () => {
  const streams = new Map<string, ReadableStreamDefaultController<Uint8Array>>();
  let connections = 0;
  const send = (id: string, event: string, data: unknown) =>
    streams.get(id)?.enqueue(new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      const path = new URL(request.url).pathname;
      if (path === "/v1/account")
        return Response.json({ login: null, features: null, cloudProjects: [], cloudProjectsLoaded: true });
      if (path === "/v1/session-stream") {
        const id = String(++connections);
        return new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              streams.set(id, controller);
              send(id, "connected", { connection_id: id });
            },
            cancel() {
              streams.delete(id);
            },
          }),
          { headers: { "content-type": "text/event-stream" } },
        );
      }
      if (request.method === "POST") {
        const input = (await request.json()) as { subscription_id: string };
        send(path.split("/")[3], "diff_ready", { subscription_id: input.subscription_id, data: {} });
        return new Response(null, { status: 204 });
      }
      if (request.method === "DELETE") return new Response(null, { status: 204 });
      return Response.json({ workspace_id: path.split("/")[3], additions: 1, deletions: 0, file_count: 1 });
    },
  });
  const first = createRuntimeCollections({ baseUrl: server.url.origin, token: "first" });
  const second = createRuntimeCollections({ baseUrl: server.url.origin, token: "second" });
  const stops: (() => void)[] = [];
  try {
    await getDashboardAccountStatusQuery(first).read();
    for (const id of ["one", "two", "three"])
      first.getWriter("workspaces")!.upsert({
        id,
        project_id: "project",
        execution_kind: "local",
        provider_state: "ready",
        root_path: "/root",
        provider_capabilities_json: { diff: true },
      });
    for (const id of ["one", "two", "three"]) {
      const query = getDashboardWorkspaceDiffQuery(id, first);
      stops.push(query.subscribe(() => {}));
      await query.read();
      await getDashboardAccountStatusQuery(second).read();
    }
    expect(connections).toBe(1);
  } finally {
    for (const stop of stops) stop();
    await first.dispose();
    await second.dispose();
    await server.stop(true);
  }
});
