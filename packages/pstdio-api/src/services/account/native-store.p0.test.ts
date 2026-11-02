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
    await createNativeStore(file).forget(login.token);
    expect(await createNativeStore(file).read()).toBeNull();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("forgetting an older credential keeps a newer login", async () => {
  const root = await mkdtemp(join(tmpdir(), "native-device-forget-"));
  const store = createNativeStore(join(root, "native-account.json"));
  try {
    await store.save(login);
    const newer = { ...login, token: "newer-device-credential" };
    await Promise.all([store.save(newer), store.forget(login.token)]);
    expect(await store.read()).toEqual(newer);
    await store.reject(login.token);
    expect(await store.read()).toEqual(newer);
    expect(await store.signInRequired(login.deviceId)).toBe(false);
    await store.forget(newer.token);
    expect(await store.read()).toBeNull();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a rejected login belongs to its device and an older logout cannot clear a newer rejection", async () => {
  const root = await mkdtemp(join(tmpdir(), "native-rejected-login-"));
  const store = createNativeStore(join(root, "native-account.json"));
  try {
    await store.save({ ...login, token: "new-credential" });
    await store.reject("new-credential");
    expect(await store.signInRequired(login.deviceId)).toBe(true);
    expect(await store.signInRequired("another-device")).toBe(false);
    await store.forget(login.token);
    expect(await store.signInRequired(login.deviceId)).toBe(true);
    await store.forget("new-credential");
    expect(await store.signInRequired(login.deviceId)).toBe(false);
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
