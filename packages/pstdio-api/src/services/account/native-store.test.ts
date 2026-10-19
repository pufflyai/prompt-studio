import { expect, test } from "bun:test";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { nativeAccountFile } from "./native-account";
import { createNativeStore } from "./native-store";

const login = {
  managerOrigin: "https://manager.test",
  relayOrigin: "https://relay.test",
  accountId: "account",
  deviceId: "device",
  token: "device-credential",
};

test("the device login stays in a private file across restarts until logout", async () => {
  const root = await mkdtemp(join(tmpdir(), "native-device-login-"));
  const file = join(root, "native-account.json");
  try {
    await createNativeStore(file).save(login);
    expect(await createNativeStore(file).read()).toEqual(login);
    if (process.platform !== "win32") expect((await stat(file)).mode & 0o777).toBe(0o600);
    await createNativeStore(file).save(null);
    expect(await createNativeStore(file).read()).toBeNull();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("independent in-memory hosts keep separate device logins", async () => {
  const root = await mkdtemp(join(tmpdir(), "native-device-isolation-"));
  try {
    const first = createNativeStore(nativeAccountFile(":memory:", join(root, "first")));
    const second = createNativeStore(nativeAccountFile(":memory:", join(root, "second")));
    await first.save(login);
    expect(await second.read()).toBeNull();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
