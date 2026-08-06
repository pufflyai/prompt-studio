import { describe, expect, test } from "bun:test";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "../../types";
import { createRuntimeRoutes, type RuntimeActivitySummary, type RuntimeHost } from "./routes";

const emptyActivity = (): RuntimeActivitySummary => ({ jobs: [], sessions: [], terminals: [] });

const createHarness = (input: { activity?: RuntimeActivitySummary } = {}) => {
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
    activity: async () => input.activity ?? emptyActivity(),
    cancelActivity: async () => {
      calls.push("cancel");
    },
  };
  const app = new OpenAPIHono<AppBindings>();
  app.route("/runtime", createRuntimeRoutes(deps));
  const request = (path: string, init: RequestInit = {}) =>
    app.request(path, { ...init, headers: { authorization: "Bearer runtime-secret", ...init.headers } });
  return { app, calls, host, request };
};

const waitFor = async (condition: () => boolean) => {
  while (!condition()) await Bun.sleep(1);
};

describe("runtime control routes", () => {
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

    host.announceShutdown();
    const event = new TextDecoder().decode((await body.read()).value);

    expect(event).toContain('"type":"intentional_shutdown"');
    expect(event).toContain('"instanceId":"runtime-one"');
  });
});
