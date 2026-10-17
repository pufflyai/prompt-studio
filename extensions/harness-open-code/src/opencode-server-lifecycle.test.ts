import { expect, test } from "bun:test";
import { createServerConnection } from "./opencode-server";
import { createOpencodeService } from "./opencode-service";

test("concurrent requests share a failed replacement and later requests can reconnect", async () => {
  const entered = [Promise.withResolvers<void>(), Promise.withResolvers<void>()];
  const release = [Promise.withResolvers<void>(), Promise.withResolvers<void>()];
  let starts = 0;
  let failReplacement = true;
  const connection = createServerConnection({
    startServer: async () => {
      starts++;
      if (starts > 1 && failReplacement) throw new Error("replacement startup failed");
      return { url: "http://127.0.0.1:4096", dispose: async () => {} };
    },
    serverStore: { read: async () => null, write: async () => {}, clear: async () => {} },
    pingServer: async () => false,
    isPortOpen: async () => false,
  });
  const requests = entered.map((gate, index) =>
    connection
      .withServerUrl(async () => {
        gate.resolve();
        await release[index]!.promise;
        throw new TypeError("fetch failed");
      })
      .catch((error: unknown) => error),
  );
  try {
    await Promise.all(entered.map((gate) => gate.promise));
    release[0]!.resolve();
    const firstError = await requests[0];
    release[1]!.resolve();
    const secondError = await requests[1];
    expect(firstError).toBeInstanceOf(Error);
    expect((firstError as Error).message).toContain("replacement startup failed");
    expect(secondError).toBe(firstError);
    expect(starts).toBe(21);
    failReplacement = false;
    expect(await connection.withServerUrl(async (url) => url)).toBe("http://127.0.0.1:4096");
  } finally {
    for (const gate of release) gate.resolve();
    await Promise.all(requests);
    await connection.dispose();
  }
});

test("a stopped owned server is replaced when a later request reconnects", async () => {
  let started = 0;
  let stopped = 0;
  let current: ReturnType<typeof Bun.serve> | undefined;
  let stored: string | null = null;
  const service = createOpencodeService({
    startServer: async () => {
      started += 1;
      const server = Bun.serve({ port: 0, fetch: () => Response.json([]) });
      current = server;
      return {
        url: server.url.origin,
        dispose: async () => {
          stopped += 1;
          await server.stop(true);
        },
      };
    },
    serverStore: {
      read: async () => stored,
      write: async (url) => {
        stored = url;
      },
      clear: async () => {
        stored = null;
      },
    },
    pingServer: async (url) => {
      if (url !== current?.url.origin) return false;
      try {
        return (await fetch(url)).ok;
      } catch {
        return false;
      }
    },
    isPortOpen: async () => false,
  });
  try {
    await service.getSessionMessages("native-session", "/project");
    await current!.stop(true);
    expect(await service.getSessionMessages("native-session", "/project")).toEqual([]);
    expect(started).toBe(2);
  } finally {
    await service.dispose();
  }
  expect(stopped).toBe(2);
  expect(stored).toBeNull();
});
