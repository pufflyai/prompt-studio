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
    expect((await fetch(callback)).status).toBe(200);
    expect(await cancelled.promise).toEqual({ ok: false, status: "complete" });
    expect(persisted).toBe(true);
    expect(requests.attempt()).toEqual({ id, status: "complete" });
  } finally {
    await requests.close();
    await manager.stop(true);
  }
});

test("a slow provider capability check cannot replace a later sign-in", async () => {
  const started = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const requests = createNativeLoginRequests(
    async () => {},
    () => {},
    async (_origin, provider) => {
      if (provider === "microsoft") {
        started.resolve();
        await release.promise;
      }
    },
  );
  const origin = "https://manager.example";
  try {
    const microsoft = requests.start(origin, "microsoft").then(
      () => true,
      () => false,
    );
    await started.promise;
    const google = requests.start(origin, "google");
    release.resolve();
    const [oldStarted, newAttempt] = await Promise.all([microsoft, google]);
    expect(oldStarted).toBe(false);
    expect(requests.status(newAttempt.id)).toBe("pending");
  } finally {
    release.resolve();
    await requests.close();
  }
});

test("a slow provider capability check does not hold up cancellation of the active callback", async () => {
  const started = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const manager = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: () =>
      Response.json({
        session: { token: "owned-session", expiresAt: new Date(Date.now() + 60_000).toISOString() },
        user: { id: "owner", email: "owner@fixture.test" },
      }),
  });
  let saved = false;
  const requests = createNativeLoginRequests(
    async () => {
      saved = true;
    },
    () => {},
    async (_origin, provider) => {
      if (provider === "microsoft") {
        started.resolve();
        await release.promise;
      }
    },
  );
  try {
    const login = await requests.start(manager.url.origin);
    const pending = requests.start(manager.url.origin, "microsoft").catch(() => {});
    await started.promise;
    const cancelled = requests.cancel(login.id);

    const start = new URL(login.url);
    const callback = new URL(start.searchParams.get("callback")!);
    callback.searchParams.set("state", start.searchParams.get("state")!);
    callback.searchParams.set("code", "controlled-code");
    const response = await fetch(callback).catch(() => null);
    release.resolve();
    await pending;

    expect(response).toBeNull();
    expect(saved).toBe(false);
    expect(await cancelled).toEqual({ ok: true, status: "failed" });
  } finally {
    release.resolve();
    await requests.close();
    await manager.stop(true);
  }
});

test.each([
  "logout",
  "close",
] as const)("a pending provider capability check cannot sign in after %s", async (action) => {
  const started = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const requests = createNativeLoginRequests(
    async () => {},
    () => {},
    async () => {
      started.resolve();
      await release.promise;
    },
  );
  try {
    const microsoft = requests.start("https://manager.example", "microsoft").then(
      () => true,
      () => false,
    );
    await started.promise;
    const cleared = action === "logout" ? requests.logout(async () => {}) : requests.close();
    release.resolve();
    await cleared;
    expect(await microsoft).toBe(false);
    expect(requests.attempt()).toBeUndefined();
  } finally {
    release.resolve();
    await requests.close();
  }
});
