import { describe, expect, test } from "bun:test";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "../../types";
import { createTerminalSupervisor } from "../extensions/extension-terminal-runtime";
import { createRuntimeRoutes, type RuntimeActivitySummary, type RuntimeHost } from "./routes";

const emptyActivity = (): RuntimeActivitySummary => ({ jobs: [], sessions: [], terminals: [] });

const createHarness = (input: { activity?: RuntimeActivitySummary | (() => RuntimeActivitySummary) } = {}) => {
  let ownerType: "desktop" | "persistent" = "desktop";
  const calls: string[] = [];
  const listeners = new Set<(event: { type: "intentional_shutdown"; instanceId: string }) => void>();
  const host: RuntimeHost = {
    instanceId: "runtime-one",
    token: "runtime-secret",
    origin: () => "http://127.0.0.1:43123",
    ownerType: () => ownerType,
    promote: async () => {
      ownerType = "persistent";
    },
    announceShutdown: () => {
      const event = { type: "intentional_shutdown" as const, instanceId: "runtime-one" };
      calls.push("announce");
      for (const listener of listeners) listener(event);
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    shutdown: async () => {
      calls.push("shutdown");
    },
  };
  const deps = {
    host,
    activity: async () =>
      typeof input.activity === "function" ? input.activity() : (input.activity ?? emptyActivity()),
    cancelActivity: async () => {
      calls.push("cancel");
    },
  };
  const app = new OpenAPIHono<AppBindings>();
  app.route("/runtime", createRuntimeRoutes(deps));
  const request = (path: string, init: RequestInit = {}) =>
    app.request(path, { ...init, headers: { authorization: "Bearer runtime-secret", ...init.headers } });
  return { app, calls, host, request, listeners };
};

const waitFor = async (condition: () => boolean) => {
  while (!condition()) await Bun.sleep(1);
};

describe("runtime control routes", () => {
  test.skipIf(process.platform === "win32")(
    "permits shutdown with an idle PTY and refuses foreground terminal work",
    async () => {
      const supervisor = createTerminalSupervisor({ logger: { info: () => {}, warn: () => {}, error: () => {} } });
      const terminal = supervisor.api.openSession({ command: ["/bin/bash", "--norc", "-i"], cols: 80, rows: 24 });
      const { request } = createHarness({ activity: () => ({ ...emptyActivity(), terminals: supervisor.activity() }) });
      const shutdown = () =>
        request("/runtime/shutdown", { method: "POST", body: JSON.stringify({ instanceId: "runtime-one" }) });
      try {
        await Bun.sleep(100);
        expect((await shutdown()).status).toBe(202);
        terminal.write("sleep 5\n");
        for (let attempt = 0; attempt < 50 && supervisor.activity().length === 0; attempt += 1) await Bun.sleep(10);
        const blocked = await shutdown();
        expect(blocked.status).toBe(409);
        expect(await blocked.json()).toMatchObject({
          error: "runtime_active",
          activity: { terminals: [{ id: terminal.id, label: "bash" }] },
        });
      } finally {
        await supervisor.dispose();
      }
    },
  );

  test("releases the event subscription when the reader cancels", async () => {
    const { request, listeners } = createHarness();
    const response = await request("/runtime/events");
    expect(listeners.size).toBe(1);
    await response.body!.cancel();
    expect(listeners.size).toBe(0);
  });
  test("keeps a quiet socket alive and delivers a later shutdown", async () => {
    const { app, host } = createHarness();
    const server = Bun.serve({ port: 0, hostname: "127.0.0.1", idleTimeout: 2, fetch: app.fetch });
    const abort = new AbortController();
    const announce = setTimeout(() => host.announceShutdown(), 3000);
    try {
      const connecting = fetch(`http://127.0.0.1:${server.port}/runtime/events`, {
        headers: { authorization: "Bearer runtime-secret" },
        signal: abort.signal,
      });
      const response = await Promise.race([connecting, Bun.sleep(200).then(() => null)]);
      expect(response).not.toBeNull();
      if (!response) return;
      expect(await response.text()).toContain('"type":"intentional_shutdown"');
    } finally {
      clearTimeout(announce);
      abort.abort();
      server.stop(true);
    }
  });

  test("requires the descriptor bearer token", async () => {
    const { app } = createHarness();

    expect((await app.request("/runtime/ready")).status).toBe(401);
    expect((await app.request("/runtime/ready", { headers: { authorization: "Bearer wrong" } })).status).toBe(401);
  });

  test("returns authenticated runtime identity and readiness", async () => {
    const { request } = createHarness();
    const response = await request("/runtime/ready");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      instanceId: "runtime-one",
      ok: true,
      ownerType: "desktop",
      protocolVersion: 1,
    });
  });

  test("provisions browser cookie auth without exposing the bearer token to JavaScript", async () => {
    const { app } = createHarness();
    const provision = await app.request("http://127.0.0.1:43123/runtime/browser-session", {
      method: "POST",
      headers: { authorization: "Bearer runtime-secret", origin: "http://127.0.0.1:43123" },
    });

    expect(provision.status).toBe(204);
    expect(await provision.text()).toBe("");
    const cookie = provision.headers.get("set-cookie")!;
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");

    const authenticated = await app.request("http://127.0.0.1:43123/runtime/ready", {
      headers: { cookie: cookie.split(";", 1)[0]!, origin: "http://127.0.0.1:43123" },
    });
    expect(authenticated.status).toBe(200);
  });

  test("promotes desktop ownership atomically and never demotes", async () => {
    const { host, request } = createHarness();
    const promote = () =>
      request("/runtime/promote", {
        body: JSON.stringify({ instanceId: "runtime-one" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });

    expect((await promote()).status).toBe(200);
    expect(host.ownerType()).toBe("persistent");
    expect((await promote()).status).toBe(200);
    expect(host.ownerType()).toBe("persistent");
  });

  test("rejects lifecycle mutations targeting a replacement instance", async () => {
    const { request } = createHarness();
    const response = await request("/runtime/promote", {
      body: JSON.stringify({ instanceId: "replacement" }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    expect(response.status).toBe(409);
  });

  test("reports backend-authoritative activity and refuses an unconfirmed shutdown", async () => {
    const activity: RuntimeActivitySummary = {
      sessions: [{ id: "session-one", label: "Implement runtime" }],
      terminals: [{ id: "terminal-one", label: "zsh" }],
      jobs: [{ id: "job-one", label: "project/heartbeat" }],
    };
    const { calls, request } = createHarness({ activity });

    const activityResponse = await request("/runtime/activity");
    expect(await activityResponse.json()).toEqual(activity);

    const shutdownResponse = await request("/runtime/shutdown", {
      body: JSON.stringify({ force: false, instanceId: "runtime-one" }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    expect(shutdownResponse.status).toBe(409);
    expect(await shutdownResponse.json()).toEqual({ activity, error: "runtime_active" });
    expect(calls).toEqual([]);
  });

  test("cancels active work, announces intentional shutdown, then exits gracefully when forced", async () => {
    const activity: RuntimeActivitySummary = {
      sessions: [{ id: "session-one", label: "Implement runtime" }],
      terminals: [],
      jobs: [],
    };
    const { calls, request } = createHarness({ activity });

    const response = await request("/runtime/shutdown", {
      body: JSON.stringify({ force: true, instanceId: "runtime-one" }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    expect(response.status).toBe(202);
    await waitFor(() => calls.includes("shutdown"));
    expect(calls).toEqual(["cancel", "announce", "shutdown"]);
  });

  test("streams the intentional shutdown event before disconnect", async () => {
    const { host, request } = createHarness();
    const response = await request("/runtime/events");
    const body = response.body!.getReader();
    await body.read();

    host.announceShutdown();
    const event = new TextDecoder().decode((await body.read()).value);

    expect(event).toContain('"type":"intentional_shutdown"');
    expect(event).toContain('"instanceId":"runtime-one"');
  });
});
