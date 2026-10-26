import { expect, test } from "bun:test";
import { blobManifestBeginSchema, syncCapabilitiesSchema } from "./blob-manifests";
import { blobBeginSchema } from "./envelopes";

const leaf = { sha256: "a".repeat(64), byteLength: 3 };
const children = Array.from({ length: 256 }, (_, n) => `child-${String(n).padStart(16, "0")}`);

test("manifest begins accept bounded unique child IDs without changing legacy leaf begins", () => {
  expect(blobManifestBeginSchema.parse({ ...leaf, children }).children).toEqual(children);
  expect(blobManifestBeginSchema.parse({ ...leaf, children: [] }).children).toEqual([]);
  for (const invalid of [[...children, "another-child-0000"], [children[0], children[0]], ["short"]])
    expect(blobManifestBeginSchema.safeParse({ ...leaf, children: invalid }).success).toBe(false);
  expect(blobManifestBeginSchema.safeParse(leaf).success).toBe(false);
  expect(blobBeginSchema.safeParse({ ...leaf, children: [] }).success).toBe(false);
  expect(blobBeginSchema.parse(leaf)).toEqual(leaf);
});

test("capabilities allow future feature names but require the supported transport version", () => {
  expect(syncCapabilitiesSchema.parse({ protocolVersion: 1, features: ["future-feature"] }).features).toEqual([
    "future-feature",
  ]);
  expect(syncCapabilitiesSchema.safeParse({ protocolVersion: 2, features: [] }).success).toBe(false);
});
