import { expect, test } from "bun:test";
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
    startServer: async () => server.url.origin,
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
