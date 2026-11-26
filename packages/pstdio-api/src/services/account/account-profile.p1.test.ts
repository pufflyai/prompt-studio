import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createNativeAccount } from "./native-account";
import { createNativeStore } from "./native-store";

test("an already signed-in device displays its current provider email without signing in again", async () => {
  const root = await mkdtemp(join(tmpdir(), "account-profile-"));
  let email = "owner@company.test";
  const manager = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request) {
      const path = new URL(request.url).pathname;
      if (path === "/v1/account") return Response.json({ features: { relay: true }, profile: { email } });
      if (path === "/v1/devices/presence") return Response.json({ ok: true });
      return Response.json([]);
    },
  });
  const file = join(root, "native-account.json");
  await createNativeStore(file).save({
    managerOrigin: manager.url.origin,
    relayOrigin: manager.url.origin,
    accountId: "owner",
    deviceId: "device",
    token: "owned-device-credential",
  });
  const account = createNativeAccount({
    file,
    environment: { get: async () => ({ environmentId: "device" }) },
    projects: { get: async () => null },
  });
  try {
    await account.refresh();
    expect((await account.status()).login).toMatchObject({ accountId: "owner", email });
    email = "renamed@company.test";
    await account.refresh();
    expect((await account.status()).login).toMatchObject({ accountId: "owner", email });
  } finally {
    await account.close();
    await manager.stop(true);
    await rm(root, { recursive: true, force: true });
  }
});
