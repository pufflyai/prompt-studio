import { expect, test } from "bun:test";
import { publicationSchema, publishedExtensionsId, validatePublicationRecord } from "./extension-publications";
import type { StoredRecord } from "./state";

const record = (): StoredRecord => ({
  recordId: "example.unrelated",
  revision: 1,
  deleted: false,
  primitive: null,
  map: {},
  value: { extensionId: "example.unrelated", revision: "a".repeat(64), automation: false, enabled: true },
  asset: { sha256: "a".repeat(64), byteLength: 123, mediaType: "application/vnd.pstdio.extension+json" },
});
test("published metadata binds one immutable package to its extension identity", () => {
  expect(validatePublicationRecord(record())?.extensionId).toBe("example.unrelated");
  const wrongBytes = record();
  wrongBytes.asset!.sha256 = "b".repeat(64);
  expect(() => validatePublicationRecord(wrongBytes)).toThrow("must agree");
  const wrongId = record();
  wrongId.recordId = "other";
  expect(() => validatePublicationRecord(wrongId)).toThrow("must agree");
  expect(
    publicationSchema.safeParse({
      extensionId: publishedExtensionsId,
      revision: "a".repeat(64),
      automation: false,
      enabled: true,
    }).success,
  ).toBe(false);
});
