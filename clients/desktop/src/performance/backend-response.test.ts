import { expect, test } from "bun:test";
import { measureBackendResponse } from "./backend-response";

test("records an unanswered request separately from finite response durations", async () => {
  let release: (value: Response) => void = () => {};
  const server = Bun.serve({
    port: 0,
    fetch: () =>
      new Promise<Response>((resolve) => {
        release = resolve;
      }),
  });
  try {
    const result = await measureBackendResponse(
      { id: "runtime", pid: null, origin: server.url.origin, token: "local", scope: "remote" },
      new AbortController().signal,
      25,
    );
    expect(result).toMatchObject({ runtimeId: "runtime", scope: "remote", state: "timeout", durationMs: null });
    expect(result.observedForMs).toBeGreaterThanOrEqual(25);
  } finally {
    release(new Response());
    await server.stop(true);
  }
});

test("cancels an outstanding measurement when collection ends", async () => {
  const controller = new AbortController();
  controller.abort();
  await expect(
    measureBackendResponse(
      { id: "runtime", pid: 1, origin: "http://127.0.0.1:1", token: "local", scope: "local" },
      controller.signal,
      1000,
    ),
  ).rejects.toThrow();
});

test("keeps only numeric runtime diagnostics and does not copy unrelated response data", async () => {
  const server = Bun.serve({
    port: 0,
    fetch: () =>
      Response.json({
        pid: process.pid,
        heapUsedBytes: 100,
        externalBytes: 20,
        counters: {
          activeSessions: 1,
          retainedMessages: 2,
          subscribers: 3,
          queuedEvents: 4,
          queuedBytes: 5,
          extensionImports: 6,
        },
        secret: "never-record-this",
      }),
  });
  try {
    const reading = await measureBackendResponse(
      { id: "runtime", pid: process.pid, origin: server.url.href, token: "test", scope: "local" },
      new AbortController().signal,
      1000,
    );
    expect(reading.state).toBe("reply");
    expect(reading.runtime?.counters.extensionImports).toBe(6);
    expect(JSON.stringify(reading)).not.toContain("never-record-this");
  } finally {
    server.stop(true);
  }
});
