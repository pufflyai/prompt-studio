import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFileConnectionSecretStore } from "./connection-secret-store";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

describe("file connection secret store", () => {
  test("lists stored references for startup reconciliation", async () => {
    const root = await mkdtemp(join(tmpdir(), "pstdio-connection-secrets-"));
    tempRoots.push(root);
    const store = createFileConnectionSecretStore(root);
    const secretRef = "c38bd7e8-e94b-4b67-b2d9-f8128ed16b20";

    await store.set("credential-canary", secretRef);

    expect(await store.listRefs()).toEqual([secretRef]);

    await store.delete(secretRef);
    expect(await store.listRefs()).toEqual([]);
  });
});
