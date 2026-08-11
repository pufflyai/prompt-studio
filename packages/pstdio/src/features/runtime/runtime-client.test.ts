import { describe, expect, test } from "bun:test";
import {
  observeRuntimeShutdown,
  promoteRuntime,
  readRuntimeActivity,
  requestRuntimeShutdown,
  waitForRuntimeExit,
} from "./runtime-client";
import type { RuntimeDescriptor } from "./runtime-descriptor";

const descriptor: RuntimeDescriptor = {
  schemaVersion: 1,
  protocolVersion: 1,
  pid: 1234,
  instanceId: "runtime-one",
  ownerType: "desktop",
  origin: "http://127.0.0.1:43127",
  token: "runtime-secret",
  appVersion: "0.25.2",
  startedAt: "2026-08-06T08:00:00.000Z",
};

describe("runtime client", () => {
  test("authenticates promotion and targets the expected instance", async () => {
    let request: Request | undefined;

    await promoteRuntime(descriptor, async (input, init) => {
      request = new Request(input, init);
      return new Response(JSON.stringify({ instanceId: "runtime-one", ownerType: "persistent" }));
    });

    expect(request!.url).toBe("http://127.0.0.1:43127/runtime/promote");
    expect(request!.headers.get("authorization")).toBe("Bearer runtime-secret");
    expect(await request!.json()).toEqual({ instanceId: "runtime-one" });
  });

  test("returns the activity summary when graceful shutdown is refused", async () => {
    const activity = { sessions: [{ id: "s1", label: "Working" }], terminals: [], jobs: [] };
    const result = await requestRuntimeShutdown(
      descriptor,
      false,
      async () => new Response(JSON.stringify({ activity, error: "runtime_active" }), { status: 409 }),
    );

    expect(result).toEqual({ state: "active", activity });
  });

  test("reads activity with descriptor bearer authentication", async () => {
    let request: Request | undefined;
    const activity = { sessions: [], terminals: [{ id: "t1", label: "Shell" }], jobs: [] };

    const result = await readRuntimeActivity(descriptor, async (input, init) => {
      request = new Request(input, init);
      return Response.json(activity);
    });

    expect(request!.url).toBe("http://127.0.0.1:43127/runtime/activity");
    expect(request!.headers.get("authorization")).toBe("Bearer runtime-secret");
    expect(result).toEqual(activity);
  });

  test("observes an intentional shutdown only for the matching runtime instance", async () => {
    let observed = false;
    const body = [
      'event: intentional_shutdown\ndata: {"type":"intentional_shutdown","instanceId":"replacement"}\n\n',
      'event: intentional_shutdown\ndata: {"type":"intentional_shutdown","instanceId":"runtime-one"}\n\n',
    ].join("");

    await observeRuntimeShutdown(
      descriptor,
      () => {
        observed = true;
      },
      async () => new Response(body, { headers: { "content-type": "text/event-stream" } }),
    );

    expect(observed).toBe(true);
  });

  test("waits without a timeout for both process exit and matching descriptor removal", async () => {
    const observations = [
      { pidAlive: true, current: descriptor },
      { pidAlive: false, current: descriptor },
      { pidAlive: false, current: null },
    ];
    let sleeps = 0;
    let observationIndex = 0;

    await waitForRuntimeExit("/tmp/runtime.json", descriptor, {
      isPidAlive: () => observations[observationIndex++]!.pidAlive,
      readDescriptor: () => observations[observationIndex]!.current,
      sleep: async () => {
        sleeps += 1;
      },
    });

    expect(sleeps).toBe(2);
  });
});
