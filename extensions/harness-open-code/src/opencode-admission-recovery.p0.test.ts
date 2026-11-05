import { expect, test } from "bun:test";
import { createOpencodeService } from "./opencode-service";

for (const command of [false, true]) {
  test(`an admitted ${command ? "command" : "prompt"} is not replayed when its response socket fails`, async () => {
    let submissions = 0;
    let starts = 0;
    const service = createOpencodeService({
      serverStore: { read: async () => null, write: async () => {}, clear: async () => {} },
      pingServer: async () => true,
      isPortOpen: async () => false,
      startServer: async () => {
        starts++;
        return { url: "http://127.0.0.1:4096", running: true, dispose: async () => {} };
      },
      fetcher: async (input) => {
        const path = new URL(String(input)).pathname;
        if (path.endsWith("/wait")) return new Response(null, { status: 204 });
        submissions++;
        if (submissions === 1) throw new Error("fetch failed", { cause: { code: "ECONNRESET" } });
        return Response.json({ data: { id: "accepted" } });
      },
    });
    try {
      const complete = command
        ? service.runCommand({ sessionId: "session", text: "/review" })
        : service.sendSessionMessage({ sessionId: "session", prompt: "Apply the change" }).messageComplete;
      await expect(complete).rejects.toThrow("fetch failed");
      expect(submissions).toBe(1);
      expect(starts).toBe(1);
    } finally {
      await service.dispose();
    }
  });
}
