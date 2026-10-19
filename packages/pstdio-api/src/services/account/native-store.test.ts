import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { nativeAccountPaths } from "./native-account";
import { createNativeStore } from "./native-store";

test("native enrollment preserves earlier workbenches across concurrent updates and restart", async () => {
  const root = await mkdtemp(join(tmpdir(), "native-enrollment-"));
  const file = join(root, "relay.json");
  const connection = (workbenchId: string) => ({
    workbenchId,
    accountId: "owner",
    environmentId: "environment",
    managerOrigin: "https://manager.test",
    relayOrigin: "https://relay.test",
    renewalGrant: `secret-${workbenchId}`,
  });
  try {
    const store = createNativeStore(file);
    await Promise.all([
      store.connect(connection("transparent-workbench")),
      store.connect(connection("built-network-workbench")),
    ]);
    expect((await createNativeStore(file).read()).connections).toEqual([
      connection("transparent-workbench"),
      connection("built-network-workbench"),
    ]);
    const before = await readFile(file, "utf8");
    await expect(store.connect({ ...connection("transparent-workbench"), accountId: "intruder" })).rejects.toThrow(
      "owner mismatch",
    );
    expect(await readFile(file, "utf8")).toBe(before);
    if (process.platform !== "win32") expect((await stat(file)).mode & 0o777).toBe(0o600);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("independent in-memory hosts do not share native enrollments through their storage parent", async () => {
  const root = await mkdtemp(join(tmpdir(), "native-owner-isolation-"));
  try {
    const first = createNativeStore(nativeAccountPaths(":memory:", join(root, "first")).connectionsFile);
    const second = createNativeStore(nativeAccountPaths(":memory:", join(root, "second")).connectionsFile);
    await first.connect({
      accountId: "owner",
      workbenchId: "workbench",
      environmentId: "first",
      managerOrigin: "https://manager.test",
      relayOrigin: "https://relay.test",
      renewalGrant: "first-host-only",
    });
    expect((await second.read()).connections).toEqual([]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
