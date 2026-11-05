import { expect, test } from "bun:test";
import { createNativeLoginRequests } from "./native-login-requests";

test("a successful native request preserves verified identity and announces completion", async () => {
  const manager = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: () =>
      Response.json({
        session: { token: "owned-session", expiresAt: new Date(Date.now() + 60_000).toISOString() },
        user: { id: "owner", email: "owner@fixture.test" },
      }),
  });
  const saved: unknown[] = [];
  const observations: unknown[] = [];
  const requests = createNativeLoginRequests(
    async (origin, token, signal, user) => {
      signal.throwIfAborted();
      saved.push({ origin, token, user });
    },
    () => observations.push(requests.attempt()),
  );
  try {
    const login = await requests.start(manager.url.origin);
    const start = new URL(login.url);
    const callback = new URL(start.searchParams.get("callback")!);
    callback.searchParams.set("state", start.searchParams.get("state")!);
    callback.searchParams.set("code", "controlled-code");
    expect((await fetch(callback)).status).toBe(200);
    expect(saved).toEqual([
      { origin: manager.url.origin, token: "owned-session", user: { email: "owner@fixture.test" } },
    ]);
    expect(observations).toContainEqual({ id: login.id, status: "pending" });
    expect(observations).toContainEqual({ id: login.id, status: "complete" });
    expect(await requests.cancel(login.id)).toEqual({ ok: false, status: "complete" });
    expect(requests.attempt()).toEqual({ id: login.id, status: "complete" });
  } finally {
    await requests.close();
    await manager.stop(true);
  }
});

test("cancellation after a fulfilled credential save reports complete instead of failed", async () => {
  const manager = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: () =>
      Response.json({
        session: { token: "owned-session", expiresAt: new Date(Date.now() + 60_000).toISOString() },
        user: { id: "owner", email: "owner@fixture.test" },
      }),
  });
  let persisted = false;
  let id = "";
  const cancelled = Promise.withResolvers<{ ok: boolean; status: string }>();
  const requests = createNativeLoginRequests(
    async () => {
      persisted = true;
      // The save fulfilled, but its callback continuation has not yet announced completion.
      void requests.cancel(id).then(cancelled.resolve, cancelled.reject);
    },
    () => {},
  );
  try {
    const login = await requests.start(manager.url.origin);
    id = login.id;
    const start = new URL(login.url);
    const callback = new URL(start.searchParams.get("callback")!);
    callback.searchParams.set("state", start.searchParams.get("state")!);
    callback.searchParams.set("code", "controlled-code");
    await fetch(callback).catch(() => null);
    expect(await cancelled.promise).toEqual({ ok: false, status: "complete" });
    expect(persisted).toBe(true);
    expect(requests.attempt()).toEqual({ id, status: "complete" });
  } finally {
    await requests.close();
    await manager.stop(true);
  }
});
