import { afterAll, beforeAll, expect, test } from "bun:test";
import { resolve } from "node:path";
import { fingerprint, publishedExtensionsId, sealMutation } from "pstdio-sync-contracts";
import { createConformanceObjects } from "pstdio-sync-contracts/conformance";
import { createRelayStorage, migrateRelayStorage } from "./storage";

const databaseUrl = process.env.SYNC_TEST_DATABASE_URL!;
const objects = createConformanceObjects(process.env.SYNC_TEST_OBJECT_ENDPOINT!);
let storage: ReturnType<typeof createRelayStorage>;
beforeAll(async () => {
  await objects.initialize();
  await migrateRelayStorage(databaseUrl, resolve(import.meta.dir, "../../drizzle"));
  storage = createRelayStorage(databaseUrl, {
    complete: async (scope, asset) => (await objects.get(scope, asset)) !== null,
  });
});
afterAll(async () => {
  await storage?.close();
  objects.close();
});

test("published packages gate visibility on complete bytes and serialize competing publications", async () => {
  const scope = { accountId: "owner", workbenchId: crypto.randomUUID(), extensionId: publishedExtensionsId };
  const owner = await storage.initialize(scope, "published-extensions-v1");
  const bytes = new TextEncoder().encode("immutable-package");
  const asset = {
    sha256: new Bun.CryptoHasher("sha256").update(bytes).digest("hex"),
    byteLength: bytes.length,
    mediaType: "application/vnd.pstdio.extension+json",
  };
  const publication = { extensionId: "example.unrelated", revision: asset.sha256, automation: false, enabled: true };
  const sealed = await sealMutation({
    protocolVersion: 1,
    scope,
    operationId: crypto.randomUUID(),
    environmentId: "a",
    parents: [],
    changes: [
      {
        recordId: publication.extensionId,
        expectedRevision: 0,
        baseDeleted: false,
        value: { expected: await fingerprint(null), next: publication },
        asset: { base: null, next: asset },
      },
    ],
  });
  expect((await owner.submit(sealed)).status).toBe("pending");
  expect((await owner.snapshot()).records).toEqual({});
  await objects.put(scope, asset, bytes);
  expect((await owner.submit(sealed)).status).toBe("accepted");
  const second = await sealMutation({
    protocolVersion: 1,
    scope,
    operationId: crypto.randomUUID(),
    environmentId: "b",
    parents: [],
    changes: [
      {
        recordId: publication.extensionId,
        expectedRevision: 0,
        baseDeleted: false,
        value: { expected: await fingerprint(null), next: { ...publication, enabled: false } },
        asset: { base: null, next: asset },
      },
    ],
  });
  expect((await owner.submit(second)).status).toBe("conflict");
  expect((await owner.snapshot()).records[publication.extensionId].value).toEqual(publication);
  const extension = await storage.initialize(
    { ...scope, extensionId: publication.extensionId },
    "unpublished-local-override",
  );
  expect((await extension.snapshot()).publishedRevision).toBe(asset.sha256);
});

test("the relay rejects catalog metadata that names different package bytes", async () => {
  const scope = { accountId: "owner", workbenchId: crypto.randomUUID(), extensionId: publishedExtensionsId };
  const owner = await storage.initialize(scope, "published-extensions-v1");
  const bytes = new TextEncoder().encode("package");
  const asset = {
    sha256: new Bun.CryptoHasher("sha256").update(bytes).digest("hex"),
    byteLength: bytes.length,
    mediaType: "application/vnd.pstdio.extension+json",
  };
  await objects.put(scope, asset, bytes);
  const mutation = await sealMutation({
    protocolVersion: 1,
    scope,
    operationId: crypto.randomUUID(),
    environmentId: "a",
    parents: [],
    changes: [
      {
        recordId: "example.unrelated",
        expectedRevision: 0,
        baseDeleted: false,
        value: {
          expected: await fingerprint(null),
          next: { extensionId: "example.unrelated", revision: "f".repeat(64), automation: false, enabled: true },
        },
        asset: { base: null, next: asset },
      },
    ],
  });
  await expect(owner.submit(mutation)).rejects.toThrow("must agree");
  expect((await owner.snapshot()).records).toEqual({});
});
