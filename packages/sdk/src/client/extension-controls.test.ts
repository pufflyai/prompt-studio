import { afterEach, describe, expect, test } from "bun:test";
import { createClient } from "./client";

const servers: ReturnType<typeof Bun.serve>[] = [];
afterEach(() => {
  for (const server of servers.splice(0)) server.stop(true);
});

describe("extension controls client", () => {
  test("keeps project and installed settings separate and preserves saved values", async () => {
    const values = new Map<string, unknown>();
    const server = Bun.serve({
      port: 0,
      async fetch(request) {
        expect(request.headers.get("authorization")).toBe("Bearer client-token");
        const key = new URL(request.url).pathname;
        if (request.method === "PUT") values.set(key, (await request.json()).value);
        if (request.method === "DELETE") {
          values.delete(key);
          return new Response(null, { status: 204 });
        }
        return Response.json({ key: "status/name", value: values.get(key) ?? "fallback" });
      },
    });
    servers.push(server);
    const { extensions } = createClient({ baseUrl: server.url.origin, token: "client-token" });

    await extensions.projectSettings.set("project/a", "instance/a", "status/name", "Ready");
    await extensions.installedSettings.set("planner/a", "status/name", "Todo");
    expect((await extensions.projectSettings.get("project/a", "instance/a", "status/name")).value).toBe("Ready");
    expect((await extensions.installedSettings.get("planner/a", "status/name")).value).toBe("Todo");
    await extensions.projectSettings.delete("project/a", "instance/a", "status/name");
    expect((await extensions.projectSettings.get("project/a", "instance/a", "status/name")).value).toBe("fallback");
    expect((await extensions.installedSettings.get("planner/a", "status/name")).value).toBe("Todo");
  });

  test("uploads exact bytes under an encoded extension owner and scoped file grant", async () => {
    const requests: Array<{ path: string; query: string; bytes: number[]; name: string | null }> = [];
    const server = Bun.serve({
      port: 0,
      async fetch(request) {
        const url = new URL(request.url);
        requests.push({
          path: url.pathname,
          query: url.search,
          bytes: [...new Uint8Array(await request.arrayBuffer())],
          name: request.headers.get("x-file-name"),
        });
        return Response.json({ id: "file-1" });
      },
    });
    servers.push(server);
    const { extensions } = createClient({ baseUrl: server.url.origin });
    const file = await extensions.files.upload("project/a", "instance/a", {
      name: "data set.csv",
      data: Uint8Array.from([0, 255, 10]),
      scope: { type: "resource", id: "ticket/a" },
    });
    expect(file.id).toBe("file-1");
    expect(requests).toEqual([
      {
        path: "/v1/projects/project%2Fa/extensions/instance%2Fa/files",
        query: "?scope_type=resource&scope_id=ticket%2Fa",
        bytes: [0, 255, 10],
        name: "data%20set.csv",
      },
    ]);
  });
});
