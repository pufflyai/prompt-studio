import { expect, test } from "bun:test";
import { createClient } from "./client";

test("the session import client exposes preview, start, progress, pause, resume and paginated failures", async () => {
  const requests: { path: string; method: string; body?: unknown }[] = [];
  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch: async (request) => {
      const url = new URL(request.url);
      requests.push({
        path: url.pathname + url.search,
        method: request.method,
        body: request.method === "POST" ? await request.json().catch(() => undefined) : undefined,
      });
      return Response.json({ id: "import", status: "running" });
    },
  });
  try {
    const client = createClient({ baseUrl: `http://127.0.0.1:${server.port}` }).sessions.imports;
    const input = { sourcePath: "/backup", storagePath: "/storage", projectMap: { old: "current" } };
    await client.preview(input);
    await client.start(input);
    await client.get("import");
    await client.pause("import");
    await client.resume("import");
    await client.errors("import", { offset: 100, limit: 25 });
    expect(requests).toEqual([
      { path: "/v1/session-imports/preview", method: "POST", body: input },
      { path: "/v1/session-imports", method: "POST", body: input },
      { path: "/v1/session-imports/import", method: "GET", body: undefined },
      { path: "/v1/session-imports/import/pause", method: "POST", body: undefined },
      { path: "/v1/session-imports/import/resume", method: "POST", body: undefined },
      { path: "/v1/session-imports/import/errors?offset=100&limit=25", method: "GET", body: undefined },
    ]);
  } finally {
    server.stop(true);
  }
});
