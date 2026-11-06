import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAccountHostFixture } from "./native-host.fixture";

test("replacing sign-in closes the previous callback and exposes one native attempt to every reader", async () => {
  const root = await mkdtemp(join(tmpdir(), "native-login-replace-"));
  const host = await createAccountHostFixture(root);
  let notifications = 0;
  const unwatch = host.account.watch(() => notifications++);
  try {
    const first = await host.account.login("https://account.fixture.test");
    expect(await host.account.status()).toMatchObject({ loginAttempt: { id: first.id, status: "pending" } });
    expect(notifications).toBeGreaterThan(0);
    const before = notifications;
    const second = await host.account.login("https://account.fixture.test");
    expect(host.account.loginStatus(first.id)).toEqual({ status: "failed" });
    const callback = new URL(new URL(first.url).searchParams.get("callback")!);
    // No code is sent: this checks closure without contacting any account service.
    await expect(fetch(callback)).rejects.toThrow();
    expect(await host.account.status()).toMatchObject({ loginAttempt: { id: second.id, status: "pending" } });
    expect(notifications).toBeGreaterThan(before);
    await host.account.cancelLogin(second.id);
    const status = await host.account.status();
    expect(status).toMatchObject({ login: null, loginAttempt: { id: second.id, status: "failed" } });
    expect(JSON.stringify(status)).not.toContain("callback");
    expect(JSON.stringify(status)).not.toContain(new URL(second.url).searchParams.get("state")!);
  } finally {
    unwatch();
    await host.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("concurrent starts admit only the latest callback and logout drains it", async () => {
  const root = await mkdtemp(join(tmpdir(), "native-login-concurrent-"));
  const host = await createAccountHostFixture(root);
  try {
    const [first, second] = await Promise.all([
      host.account.login("https://account.fixture.test"),
      host.account.login("https://account.fixture.test"),
    ]);
    expect(host.account.loginStatus(first.id)).toEqual({ status: "failed" });
    expect(host.account.loginStatus(second.id)).toEqual({ status: "pending" });
    await host.account.logout();
    expect(host.account.loginStatus(second.id)).toEqual({ status: "failed" });
    const callback = new URL(new URL(second.url).searchParams.get("callback")!);
    await expect(fetch(callback)).rejects.toThrow();
    expect(await host.account.status()).toEqual({
      login: null,
      cloudProjects: [],
      cloudProjectsLoaded: true,
      features: null,
    });
  } finally {
    await host.close();
    await rm(root, { recursive: true, force: true });
  }
});
