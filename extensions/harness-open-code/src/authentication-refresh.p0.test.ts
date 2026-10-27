import { expect, test } from "bun:test";
import { createOpencodeHarness } from "./harness";
import { ctx, harnessDefaults, serviceOverrides } from "./harness.test-helpers";
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

test("an owned server cleanup failure does not prevent reconnecting", async () => {
  let stored: string | null = null;
  let starts = 0;
  const errors: string[] = [];
  const context = { ...ctx, logger: { ...ctx.logger, error: (message: string) => errors.push(message) } };
  const services = createOpencodeHarnessService({
    ...serviceOverrides(),
    fetcher: async () => Response.json([]),
    isPortOpen: async () => false,
    serverStore: {
      read: async () => stored,
      write: async (url) => {
        stored = url;
      },
      clear: async () => {
        stored = null;
      },
    },
    startServer: async () => {
      const generation = ++starts;
      return {
        url: `http://localhost:${4095 + generation}`,
        dispose: async () => {
          if (generation === 1) throw new Error("transient cleanup failure");
        },
      };
    },
  });
  try {
    const first = await services.get(context);
    await first.getSessionMessages("existing");
    await expect(services.invalidateAuthentication()).rejects.toThrow("transient cleanup failure");
    const second = await services.get(context);
    await second.getSessionMessages("existing");
    expect(starts).toBe(2);
    expect(errors).toHaveLength(1);
  } finally {
    await services.dispose(context).catch(() => {});
  }
});

test.each(["authentication", "history"])("cleanup preserves an in-flight %s read", async (kind) => {
  const requested = Promise.withResolvers<void>();
  const reply = Promise.withResolvers<void>();
  let stops = 0;
  const server = Bun.serve({
    port: 0,
    fetch: async (req) => {
      const path = new URL(req.url).pathname;
      if (path === "/provider/auth") return Response.json({});
      requested.resolve();
      await reply.promise;
      return Response.json(path === "/provider" ? { all: [], connected: [] } : []);
    },
  });
  const harness = createOpencodeHarness(harnessDefaults(), {
    ...serviceOverrides(),
    isPortOpen: async () => false,
    startServer: async () => ({
      url: server.url.origin,
      dispose: async () => {
        stops++;
      },
    }),
  });
  const reading =
    kind === "authentication"
      ? harness.getAuthentication!(ctx, {})
      : harness.getMessages!(ctx, { agentSessionId: "existing" });
  await requested.promise;
  const disposing = harness.dispose!(ctx);
  try {
    await Bun.sleep(0);
    expect(stops).toBe(0);
    reply.resolve();
    await reading;
    await disposing;
    expect(stops).toBe(1);
  } finally {
    reply.resolve();
    await Promise.allSettled([reading, disposing]);
    await server.stop(true);
  }
});
