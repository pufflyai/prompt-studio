import { expect, test } from "bun:test";
import { ctx } from "./harness.test-helpers";
import { createOpencodeHarnessService } from "./opencode-harness-service";

test("account refresh uses a new provider snapshot without stopping active sessions", async () => {
  let credential = false;
  let stored: string | null = null;
  let starts = 0;
  let stops = 0;
  const retired = Promise.withResolvers<void>();
  const done = Promise.withResolvers<{ status: "completed" }>();
  const services = createOpencodeHarnessService({
    serverStore: {
      read: async () => stored,
      write: async (value) => {
        stored = value;
      },
      clear: async () => {
        stored = null;
      },
    },
    pingServer: async () => true,
    isPortOpen: async () => false,
    startServer: async () => {
      const generation = ++starts;
      const connected = credential ? ["openai"] : [];
      const server = Bun.serve({
        port: 0,
        fetch: (req) => {
          if (new URL(req.url).pathname === "/provider")
            return Response.json({ all: [{ id: "openai", name: "OpenAI", source: "api", models: {} }], connected });
          if (new URL(req.url).pathname === "/provider/auth") return Response.json({});
          return Response.json([]);
        },
      });
      return {
        url: server.url.origin,
        dispose: async () => {
          await server.stop(true);
          stops++;
          if (generation === 1) retired.resolve();
        },
      };
    },
  });
  try {
    const first = await services.get(ctx);
    expect((await first.getAuthentication({ model: "openai/gpt" })).status).toBe("signed_out");
    await services.track(ctx, {
      agentSessionId: "active",
      done: done.promise,
      stop: async () => {
        done.resolve({ status: "completed" });
      },
    });
    credential = true;
    await services.invalidateAuthentication();
    const second = await services.get(ctx);
    expect((await second.getAuthentication({ model: "openai/gpt" })).status).toBe("signed_in");
    expect(starts).toBe(2);
    expect(stops).toBe(0);
    expect(await first.getSessionMessages("active")).toEqual([]);
    done.resolve({ status: "completed" });
    await retired.promise;
    expect(stops).toBe(1);
  } finally {
    done.resolve({ status: "completed" });
    await services.dispose(ctx);
  }
  expect(stops).toBe(2);
});
