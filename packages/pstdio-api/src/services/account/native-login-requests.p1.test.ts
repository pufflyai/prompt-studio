import { expect, test } from "bun:test";
import { createNativeLoginRequests } from "./native-login-requests";

const serveManager = () =>
  Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: () =>
      Response.json({
        session: { token: "owned-session", expiresAt: new Date(Date.now() + 60_000).toISOString() },
        user: { id: "owner", email: "owner@fixture.test" },
      }),
  });

const submitCallback = (loginUrl: string) => {
  const start = new URL(loginUrl);
  const callback = new URL(start.searchParams.get("callback")!);
  callback.searchParams.set("state", start.searchParams.get("state")!);
  callback.searchParams.set("code", "controlled-code");
  return fetch(callback);
};

test("a successful native request preserves verified identity and announces completion", async () => {
  const manager = serveManager();
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
    expect((await submitCallback(login.url)).status).toBe(200);
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
  const manager = serveManager();
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
    expect((await submitCallback(login.url)).status).toBe(200);
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
    async () => {
      started.resolve();
      await release.promise;
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
  const manager = serveManager();
  let saved = false;
  const requests = createNativeLoginRequests(
    async () => {
      saved = true;
    },
    () => {},
    async () => {
      started.resolve();
      await release.promise;
    },
  );
  try {
    const login = await requests.start(manager.url.origin);
    const pending = requests.start(manager.url.origin, "microsoft").catch(() => {});
    await started.promise;
    const cancelled = requests.cancel(login.id);

    const response = await submitCallback(login.url).catch(() => null);
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

test("an unsupported Microsoft manager leaves an earlier capability check pending", async () => {
  const supported = "https://supported.example";
  const unsupported = "https://unsupported.example";
  const check = Promise.withResolvers<void>();
  const requests = createNativeLoginRequests(
    async () => {},
    () => {},
    (origin) => (origin === supported ? check.promise : Promise.reject(new Error("Microsoft unavailable"))),
  );
  const earlier = requests.start(supported, "microsoft");
  try {
    await expect(requests.start(unsupported, "microsoft")).rejects.toThrow("Microsoft unavailable");
    check.resolve();

    const login = await earlier;
    expect(new URL(login.url).origin).toBe(supported);
    expect(requests.attempt()).toEqual({ id: login.id, status: "pending" });
  } finally {
    const closed = requests.close();
    check.resolve();
    await Promise.allSettled([earlier, closed]);
  }
});

test("an unsupported Microsoft manager cannot interrupt a validated replacement", async () => {
  const supported = "https://supported.example";
  const unsupported = "https://unsupported.example";
  const saving = Promise.withResolvers<void>();
  const closing = Promise.withResolvers<void>();
  const releaseSave = Promise.withResolvers<void>();
  const manager = serveManager();
  const requests = createNativeLoginRequests(
    async (_origin, _token, signal) => {
      signal.addEventListener("abort", () => closing.resolve(), { once: true });
      saving.resolve();
      await releaseSave.promise;
      signal.throwIfAborted();
    },
    () => {},
    async (origin) => {
      if (origin === unsupported) throw new Error("Microsoft unavailable");
    },
  );
  try {
    const google = await requests.start(manager.url.origin);
    const callback = submitCallback(google.url).catch(() => null);
    await saving.promise;
    const earlier = requests.start(supported, "microsoft");
    await closing.promise;
    await expect(requests.start(unsupported, "microsoft")).rejects.toThrow("Microsoft unavailable");
    releaseSave.resolve();

    const [login] = await Promise.all([earlier, callback]);
    expect(new URL(login.url).origin).toBe(supported);
    expect(requests.status(google.id)).toBe("failed");
    expect(requests.attempt()).toEqual({ id: login.id, status: "pending" });
  } finally {
    releaseSave.resolve();
    await requests.close();
    await manager.stop(true);
  }
});

test("a newer supported Microsoft request replaces the earlier one after validation", async () => {
  const earlierOrigin = "https://earlier.example";
  const newerOrigin = "https://newer.example";
  const earlierCheck = Promise.withResolvers<void>();
  const newerCheck = Promise.withResolvers<void>();
  const requests = createNativeLoginRequests(
    async () => {},
    () => {},
    (origin) => (origin === earlierOrigin ? earlierCheck.promise : newerCheck.promise),
  );
  const earlier = requests.start(earlierOrigin, "microsoft");
  const newer = requests.start(newerOrigin, "microsoft");
  try {
    earlierCheck.resolve();
    const firstLogin = await earlier;
    expect(requests.attempt()).toEqual({ id: firstLogin.id, status: "pending" });

    newerCheck.resolve();
    const nextLogin = await newer;
    expect(new URL(nextLogin.url).origin).toBe(newerOrigin);
    expect(requests.status(firstLogin.id)).toBe("failed");
    expect(requests.attempt()).toEqual({ id: nextLogin.id, status: "pending" });
  } finally {
    const closed = requests.close();
    earlierCheck.resolve();
    newerCheck.resolve();
    await Promise.allSettled([earlier, newer, closed]);
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
