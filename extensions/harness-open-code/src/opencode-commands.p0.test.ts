import { expect, test } from "bun:test";
import { createCommandApi } from "./opencode-commands";
import { createOpencodeService } from "./opencode-service";

test("native commands use the session command endpoint and compaction uses the compact endpoint", async () => {
  const requests: Array<{ url: string; body: unknown }> = [];
  const server = Bun.serve({
    port: 0,
    fetch: async (request) => {
      const url = new URL(request.url);
      if (url.pathname === "/api/provider") return Response.json({ data: [] });
      if (url.pathname === "/api/command")
        return Response.json({ data: [{ name: "review", description: "Review the changes" }] });
      if (url.pathname.endsWith("/wait")) return new Response(null, { status: 204 });
      requests.push({ url: url.pathname, body: await request.json() });
      return Response.json(true);
    },
  });
  const service = createOpencodeService({
    startServer: async () => ({ running: true, url: server.url.origin, dispose: async () => {} }),
    serverStore: { read: async () => server.url.origin, write: async () => {}, clear: async () => {} },
    pingServer: async () => true,
    isPortOpen: async () => false,
  });
  try {
    expect(await service.getCommands("/repo")).toEqual([{ name: "/review", description: "Review the changes" }]);
    await service.runCommand({ sessionId: "ses_one", text: "/review keep  spaces", cwd: "/repo" });
    await service.runCommand({ sessionId: "ses_one", text: "/compact ", model: "openai/gpt-5", cwd: "/repo" });
    expect(requests).toEqual([
      { url: "/api/session/ses_one/command", body: { name: "review", text: "keep  spaces" } },
      { url: "/api/session/ses_one/model", body: { model: { providerID: "openai", id: "gpt-5" } } },
      { url: "/api/session/ses_one/compact", body: {} },
    ]);
  } finally {
    server.stop(true);
  }
});

test("native commands apply a newly selected model before admission", async () => {
  const requests: Array<{ path: string; body: unknown }> = [];
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      const path = new URL(request.url).pathname;
      if (path.endsWith("/wait")) return new Response(null, { status: 204 });
      requests.push({ path, body: await request.json() });
      return new Response(null, { status: 204 });
    },
  });
  try {
    const api = createCommandApi({ fetcher: fetch, withServerUrl: (action) => action(server.url.origin) });
    await api.runCommand({
      sessionId: "session",
      text: "/review",
      model: "opencode-go/minimax-m3",
      params: { variant: "thinking" },
    });
    expect(requests).toEqual([
      {
        path: "/api/session/session/model",
        body: { model: { providerID: "opencode-go", id: "minimax-m3", variant: "thinking" } },
      },
      { path: "/api/session/session/command", body: { name: "review", text: "" } },
    ]);
  } finally {
    await server.stop(true);
  }
});

test("unchanged command definitions are reused, expire, and refresh after a native action", async () => {
  let reads = 0;
  let now = 0;
  let name = "review";
  const server = Bun.serve({
    port: 0,
    fetch: (request) => {
      if (new URL(request.url).pathname === "/api/provider") return Response.json({ data: [] });
      if (new URL(request.url).pathname === "/api/command") {
        reads += 1;
        return Response.json({ data: [{ name }] });
      }
      return Response.json(true);
    },
  });
  const api = createCommandApi({
    fetcher: fetch,
    withServerUrl: (action) => action(server.url.origin),
    now: () => now,
  });
  try {
    await api.getCommands("/project");
    await api.getCommands("/project");
    expect(reads).toBe(1);
    name = "updated";
    now += 30_001;
    expect(await api.getCommands("/project")).toEqual([{ name: "/updated", description: "Native OpenCode command" }]);
    expect(reads).toBe(2);
    await api.runCommand({ sessionId: "session", cwd: "/project", text: "/updated" });
    await api.getCommands("/project");
    expect(reads).toBe(3);
    await api.getCommands("/other-project");
    expect(reads).toBe(4);
  } finally {
    await server.stop(true);
  }
});
