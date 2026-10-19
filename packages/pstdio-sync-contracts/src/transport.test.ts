import { expect, test } from "bun:test";
import { relayAssetBeginSchema, relayAssetReadSchema, relayEventSchema, relayPath, relayRoute } from "./transport";

test("relay routes round trip opaque identities without account or credential URL fields", () => {
  const target = { workbenchId: "work /?#%", extensionId: "notes/日本語" };
  const path = relayPath(target, "snapshot");
  expect(relayRoute(path)).toEqual({ ...target, operation: "snapshot" });
  const scope = { ...target, accountId: "never-in-the-url" };
  expect(relayPath(scope, "snapshot")).toBe(path);
  const dots = { workbenchId: ".", extensionId: ".." };
  expect(relayRoute(new URL(relayPath(dots, "snapshot"), "https://relay.test").pathname)).toEqual({
    ...dots,
    operation: "snapshot",
  });
  expect(relayRoute("/v1/workbenches/w/extensions/e/initialize")).toBeNull();
  expect(relayRoute("/v1/workbenches/%XX/extensions/e/snapshot")).toBeNull();
  expect(relayRoute(`${path}?token=secret`)).toBeNull();
});

test("asset requests reject extra claims and invalid resume offsets", () => {
  const asset = { sha256: "a".repeat(64), byteLength: 5, mediaType: "text/plain" };
  expect(relayAssetBeginSchema.parse({ uploadId: "id", asset })).toEqual({ uploadId: "id", asset });
  expect(relayAssetBeginSchema.safeParse({ uploadId: "id", asset, accountId: "claim" }).success).toBe(false);
  expect(relayAssetReadSchema.parse({ asset, offset: 5 })).toEqual({ asset, offset: 5 });
  for (const offset of [-1, 1.5, 6, Number.MAX_SAFE_INTEGER + 1])
    expect(relayAssetReadSchema.safeParse({ asset, offset }).success).toBe(false);
});

test("subscription messages carry only versioned readiness or change hints", () => {
  expect(relayEventSchema.parse({ protocolVersion: 2, type: "ready" }).type).toBe("ready");
  expect(relayEventSchema.parse({ protocolVersion: 2, type: "changed" }).type).toBe("changed");
  expect(relayEventSchema.safeParse({ protocolVersion: 2, type: "changed", records: {} }).success).toBe(false);
});
