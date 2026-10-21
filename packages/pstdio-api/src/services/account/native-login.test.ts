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

test("native sign-in opens the account manager under its address path", () => {
  const login = startNativeLogin("https://base.example.com/accounts", async () => {});
  try {
    const start = new URL(login.url);
    expect(`${start.origin}${start.pathname}`).toBe("https://base.example.com/accounts/v1/native-login");
  } finally {
    login.close();
  }
});
