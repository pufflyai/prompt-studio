import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAccountHostFixture } from "./native-host.fixture";

const login = (deviceId: string) => ({
  // Nothing listens on port 1, so the account service is unreachable.
  managerOrigin: "https://127.0.0.1:1",
  relayOrigin: "https://127.0.0.1:1",
  accountId: "account",
  deviceId,
  token: "device-credential",
});

test("logout clears the login even when the account service is unreachable", async () => {
  const root = await mkdtemp(join(tmpdir(), "native-account-offline-"));
  const host = await createAccountHostFixture(root);
  try {
    const { environmentId } = await host.deps.environmentService.get();
    await Bun.write(host.file, JSON.stringify({ login: login(environmentId) }));
    expect((await host.account.status()).login?.deviceId).toBe(environmentId);
    expect(await host.account.logout()).toEqual({ ok: true, removed: false });
    expect(await host.account.status()).toEqual({ login: null, cloudProjects: [] });
    expect(JSON.parse(await readFile(host.file, "utf8"))).toEqual({ login: null });
  } finally {
    await host.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("a login saved for another device counts as logged out and syncs nothing", async () => {
  const root = await mkdtemp(join(tmpdir(), "native-account-other-device-"));
  const host = await createAccountHostFixture(root);
  try {
    await Bun.write(host.file, JSON.stringify({ login: login("another-database") }));
    await host.account.refresh();
    expect(await host.account.status()).toEqual({ login: null, cloudProjects: [] });
    expect(host.synced()).toEqual([]);
  } finally {
    await host.close();
    await rm(root, { recursive: true, force: true });
  }
});
