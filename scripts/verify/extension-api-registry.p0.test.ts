import { expect, test } from "bun:test";
import { sdkRegistryBaselines } from "./extension-api-registry";

test("discovers a published SDK API preview without any host tag", () => {
  const releases = sdkRegistryBaselines({
    versions: {
      "0.46.0-preview.sha-one": { pstdio: { extensionApiVersion: "0.3.0" } },
      "0.45.0": {},
    },
  });
  expect(releases).toEqual([{ sdk: "0.46.0-preview.sha-one", api: "0.3.0" }]);
});

test("does not infer an API version from an SDK package version", () => {
  expect(sdkRegistryBaselines({ versions: { "9.0.0": {} } })).toEqual([]);
});

test("rejects malformed API metadata in a published SDK", () => {
  expect(() => sdkRegistryBaselines({ versions: { "0.46.0": { pstdio: { extensionApiVersion: "later" } } } })).toThrow(
    "0.46.0",
  );
});
