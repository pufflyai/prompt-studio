import { expect, spyOn, test } from "bun:test";
import { createNativePresence } from "./native-presence";

test("a device heartbeats without a Cloud project, repeats, and stops on logout", async () => {
  const timers: (() => void)[] = [];
  const original = setTimeout;
  const clock = spyOn(globalThis, "setTimeout").mockImplementation(((...args: Parameters<typeof setTimeout>) => {
    if (args[1] === 15_000) timers.push(args[0]);
    return original(...args);
  }) as typeof setTimeout);
  let calls = 0;
  const repeated = Promise.withResolvers<void>();
  const manager = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request) {
      expect(new URL(request.url).pathname).toBe("/v1/devices/presence");
      expect(request.headers.get("authorization")).toBe("Bearer fixture-device");
      calls++;
      if (calls === 2) repeated.resolve();
      return Response.json({ ok: true });
    },
  });
  const presence = createNativePresence({ denied: async () => {} });
  try {
    const login = {
      managerOrigin: manager.url.origin,
      relayOrigin: manager.url.origin,
      accountId: "account",
      deviceId: "device",
      token: "fixture-device",
    };
    await presence.update(login);
    expect(calls).toBe(1);
    await presence.update(login);
    expect(calls).toBe(1);
    timers[0]();
    await repeated.promise;
    await presence.update(null);
    timers.at(-1)?.();
    await Bun.sleep(20);
    expect(calls).toBe(2);
  } finally {
    presence.close();
    clock.mockRestore();
    await manager.stop(true);
  }
});

test("a removed device stops heartbeating and tells the native credential owner", async () => {
  let removed: string | undefined;
  const manager = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => Response.json({}, { status: 401 }) });
  const presence = createNativePresence({
    denied: async (credential) => {
      removed = credential.token;
    },
  });
  try {
    await presence.update({
      managerOrigin: manager.url.origin,
      relayOrigin: manager.url.origin,
      accountId: "account",
      deviceId: "device",
      token: "removed-device",
    });
    expect(removed).toBe("removed-device");
  } finally {
    presence.close();
    await manager.stop(true);
  }
});

test("equal-token logins at different managers replace the heartbeat owner", async () => {
  let firstCalls = 0;
  let secondCalls = 0;
  const first = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: () => {
      firstCalls++;
      return Response.json({ ok: true });
    },
  });
  const second = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: () => {
      secondCalls++;
      return Response.json({ ok: true });
    },
  });
  const presence = createNativePresence({ denied: async () => {} });
  try {
    const login = { token: "same-token", deviceId: "device", accountId: "account", relayOrigin: first.url.origin };
    await presence.update({ ...login, managerOrigin: first.url.origin });
    await presence.update({ ...login, managerOrigin: second.url.origin });
    expect([firstCalls, secondCalls]).toEqual([1, 1]);
  } finally {
    presence.close();
    await Promise.all([first.stop(true), second.stop(true)]);
  }
});
