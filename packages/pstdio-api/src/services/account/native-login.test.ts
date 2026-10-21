import { expect, test } from "bun:test";
import { startNativeLogin } from "./native-login";

test("closing native sign-in prevents a delayed exchange from saving an owner session", async () => {
  const received = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const manager = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch() {
      received.resolve();
      await release.promise;
      return Response.json({
        session: { token: "late-session", expiresAt: new Date(Date.now() + 60_000).toISOString() },
        user: { id: "owner", email: "owner@fixture.test" },
      });
    },
  });
  const saved: string[] = [];
  const login = startNativeLogin(manager.url.origin, async (token) => {
    saved.push(token);
  });
  const start = new URL(login.url);
  const callback = new URL(start.searchParams.get("callback")!);
  callback.searchParams.set("state", start.searchParams.get("state")!);
  callback.searchParams.set("code", "owned-one-time-code");
  const response = fetch(callback).catch(() => null);
  try {
    await received.promise;
    login.close();
    release.resolve();
    await response;
    await Bun.sleep(10);
    expect(saved).toEqual([]);
    expect(login.status()).toBe("failed");
  } finally {
    release.resolve();
    login.close();
    await manager.stop(true);
  }
});

test("native sign-in passes the verified account identity to its owner", async () => {
  const manager = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: () =>
      Response.json({
        session: { token: "session", expiresAt: new Date(Date.now() + 60_000).toISOString() },
        user: { id: "google-user", email: "owner@fixture.test" },
      }),
  });
  let identity: unknown;
  const login = startNativeLogin(manager.url.origin, async (_token, _signal, user) => {
    identity = user;
  });
  try {
    const url = new URL(login.url);
    const callback = new URL(url.searchParams.get("callback")!);
    callback.searchParams.set("state", url.searchParams.get("state")!);
    callback.searchParams.set("code", "one-time-code");
    expect((await fetch(callback)).status).toBe(200);
    expect(identity).toEqual({ email: "owner@fixture.test" });
  } finally {
    login.close();
    await manager.stop(true);
  }
});

test("cancelling waits for an in-flight save to finish its abort cleanup", async () => {
  const saving = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  let cleaned = false;
  const manager = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: () =>
      Response.json({
        session: { token: "session", expiresAt: new Date(Date.now() + 60_000).toISOString() },
        user: { id: "owner", email: "owner@fixture.test" },
      }),
  });
  const login = startNativeLogin(manager.url.origin, async (_token, signal) => {
    saving.resolve();
    await release.promise;
    cleaned = signal.aborted;
    signal.throwIfAborted();
  });
  const url = new URL(login.url);
  const callback = new URL(url.searchParams.get("callback")!);
  callback.searchParams.set("state", url.searchParams.get("state")!);
  callback.searchParams.set("code", "one-time-code");
  const response = fetch(callback).catch(() => null);
  try {
    await saving.promise;
    let closed = false;
    const closing = Promise.resolve(login.close()).then(() => {
      closed = true;
    });
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(closed).toBe(false);
    release.resolve();
    await closing;
    expect(cleaned).toBe(true);
    expect(login.status()).toBe("failed");
  } finally {
    release.resolve();
    await login.close();
    await response;
    await manager.stop(true);
  }
});

test("native sign-in opens the account manager under its address path", () => {
  const login = startNativeLogin("https://base.example.com/accounts", async () => {});
  try {
    const start = new URL(login.url);
    expect(`${start.origin}${start.pathname}`).toBe("https://base.example.com/accounts/v1/native-login");
  } finally {
    login.close();
  }
});
