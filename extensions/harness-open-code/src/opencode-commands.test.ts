import { expect, test } from "bun:test";
import { createCommandApi } from "./opencode-commands";
import { createOpencodeService } from "./opencode-service";

test("native commands use the session command endpoint and compaction uses summarize", async () => {
  const requests: Array<{ url: string; body: unknown }> = [];
  const server = Bun.serve({
    port: 0,
    fetch: async (request) => {
      const url = new URL(request.url);
      if (url.pathname === "/command")
        return Response.json([{ name: "review", description: "Review the changes", template: "private template" }]);
      requests.push({ url: url.pathname, body: await request.json() });
      return Response.json(true);
    },
  });
  const service = createOpencodeService({
    startServer: async () => ({ url: server.url.origin, dispose: async () => {} }),
    serverStore: { read: async () => server.url.origin, write: async () => {}, clear: async () => {} },
    pingServer: async () => true,
    isPortOpen: async () => false,
  });
  try {
    expect(await service.getCommands("/repo")).toEqual([{ name: "/review", description: "Review the changes" }]);
    await service.runCommand({ sessionId: "ses_one", text: "/review keep  spaces", cwd: "/repo" });
    await service.runCommand({ sessionId: "ses_one", text: "/compact", model: "openai/gpt-5", cwd: "/repo" });
    expect(requests).toEqual([
      { url: "/session/ses_one/command", body: { command: "review", arguments: "keep  spaces" } },
      { url: "/session/ses_one/summarize", body: { providerID: "openai", modelID: "gpt-5", auto: false } },
    ]);
  } finally {
    server.stop(true);
  }
});

test("unchanged command definitions are reused, expire, and refresh after a native action", async () => {
  let reads = 0;
  let now = 0;
  let name = "review";
  const server = Bun.serve({
    port: 0,
    fetch: (request) => {
      if (new URL(request.url).pathname === "/command") {
        reads += 1;
        return Response.json([{ name }]);
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
