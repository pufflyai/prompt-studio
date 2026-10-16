import { expect, test } from "bun:test";
import { createOpencodeService } from "./opencode-service";

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
