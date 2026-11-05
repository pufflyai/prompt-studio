import { expect, test } from "bun:test";
import { createOpencodeService } from "./opencode-service";

test("cancelling a completion wait does not retry it", async () => {
  const controller = new AbortController();
  const reason = new DOMException("Cancelled by the user", "AbortError");
  let waits = 0;
  const service = createOpencodeService({
    serverStore: { read: async () => "http://127.0.0.1:4096", write: async () => {}, clear: async () => {} },
    pingServer: async () => true,
    fetcher: async (input) => {
      if (new URL(String(input)).pathname.endsWith("/wait")) {
        waits++;
        controller.abort(reason);
        throw controller.signal.reason;
      }
      return Response.json({ data: { id: "accepted" } });
    },
  });
  try {
    await expect(service.runCommand({ sessionId: "session", text: "/review", signal: controller.signal })).rejects.toBe(
      reason,
    );
    expect(waits).toBe(1);
  } finally {
    await service.dispose();
  }
});

for (const command of [false, true]) {
  for (const timeout of [false, true]) {
    test(`${command ? "commands" : "follow-ups"} recover a ${timeout ? "wait timeout" : "wait connection failure"} without resubmitting accepted work`, async () => {
      let submissions = 0;
      let waits = 0;
      const service = createOpencodeService({
        serverStore: { read: async () => "http://127.0.0.1:4096", write: async () => {}, clear: async () => {} },
        pingServer: async () => true,
        fetcher: async (input) => {
          const path = new URL(String(input)).pathname;
          if (path.endsWith("/wait")) {
            waits++;
            if (waits === 1) {
              if (timeout) throw new DOMException("Request timed out", "TimeoutError");
              throw new Error("fetch failed", { cause: { code: "ECONNRESET" } });
            }
            return new Response(null, { status: 204 });
          }
          submissions++;
          return Response.json({ data: { id: "accepted" } });
        },
      });
      try {
        const completion = command
          ? service.runCommand({ sessionId: "session", text: "/review" })
          : service.sendSessionMessage({ sessionId: "session", prompt: "Continue" }).messageComplete;
        await completion;
        expect(submissions).toBe(1);
        expect(waits).toBe(2);
      } finally {
        await service.dispose();
      }
    });
  }
}
