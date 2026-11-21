import { expect, test } from "bun:test";
import { selectProductionArtifacts } from "./production-artifacts";

const names = [
  "release-build-attempt-1",
  "desktop-linux-x64",
  "validation-app-linux-x64",
  "desktop-darwin-arm64",
  "validation-app-darwin-arm64",
  "service-container-relay",
  "service-container-account-manager",
];
const listed = names.map((name, index) => ({
  id: 100 + index,
  name,
  digest: `sha256:${String(index).repeat(64).slice(0, 64)}`,
  expired: false,
}));

test("an artifact repeated across listing pages is selected once", () => {
  // Release run 44876036611: a new upload shifted the newest-first listing, so the
  // last artifact of page one appeared again at the start of page two.
  const repeated = [...listed, listed[4]!];
  expect(selectProductionArtifacts(repeated, 1, "nightly")).toEqual(selectProductionArtifacts(listed, 1, "nightly"));
});

test("two different artifacts with one required name stay ambiguous", () => {
  const conflicting = [...listed, { ...listed[4]!, id: 999 }];
  expect(() => selectProductionArtifacts(conflicting, 1, "nightly")).toThrow(
    "validation-app-darwin-arm64: artifact identity is unavailable or ambiguous",
  );
});

test("a missing required artifact is still reported", () => {
  expect(() => selectProductionArtifacts(listed.slice(1), 1, "nightly")).toThrow(
    "Missing production artifacts: release-build-attempt-1",
  );
});
