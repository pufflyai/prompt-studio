import { expect, test } from "bun:test";
import { matchingExistingBuild } from "./production-existing-candidate";

test("reuses only the archive built for the exact existing generated candidate", () => {
  const identity = {
    sourceSha: "a".repeat(40),
    versionSha: "b".repeat(40),
    toolchain: "bun-1.4.4",
    payloadDigest: "c".repeat(64),
  };
  expect(matchingExistingBuild(identity, identity.sourceSha, identity.versionSha, "bun-1.4.4")).toBe(true);
  expect(matchingExistingBuild(identity, "d".repeat(40), identity.versionSha, "bun-1.4.4")).toBe(false);
  expect(matchingExistingBuild(identity, identity.sourceSha, "e".repeat(40), "bun-1.4.4")).toBe(false);
  expect(matchingExistingBuild(identity, identity.sourceSha, identity.versionSha, "bun-old")).toBe(false);
});
