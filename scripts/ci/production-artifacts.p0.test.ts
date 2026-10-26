import { expect, test } from "bun:test";
import { productionPolicyFiles, selectProductionArtifacts } from "./production-artifacts";

const artifact = (name: string) => ({ id: name.length, name, digest: `sha256:${"a".repeat(64)}`, expired: false });
test("nightly requires only its published Linux and Apple Silicon desktop artifacts", () => {
  const names = [
    "release-build-attempt-1",
    ...["linux-x64", "darwin-arm64"].flatMap((target) => [`desktop-${target}`, `validation-app-${target}`]),
    "service-container-relay",
    "service-container-account-manager",
  ];
  expect(selectProductionArtifacts(names.map(artifact), 1, "nightly").map((entry) => entry.name)).toEqual(names);
});
test("selects exact attempt artifacts and requires every production target", () => {
  const names = [
    "release-build-attempt-2",
    ...["linux-x64", "darwin-arm64", "darwin-x64", "win32-x64"].flatMap((target) => [
      `desktop-${target}`,
      `validation-app-${target}`,
    ]),
    "service-container-relay",
    "service-container-account-manager",
  ];
  expect(
    selectProductionArtifacts(
      [...names.map(artifact), artifact("release-build-attempt-1"), artifact("test-results")],
      2,
      "stable",
    )
      .map((entry) => entry.name)
      .sort(),
  ).toEqual(names.sort());
});
test("missing, expired and unsigned artifact identities cannot certify", () => {
  expect(() => selectProductionArtifacts([], 1, "stable")).toThrow("Missing production artifacts");
  expect(() =>
    selectProductionArtifacts([{ ...artifact("release-build-attempt-1"), expired: true }], 1, "nightly"),
  ).toThrow();
  expect(() =>
    selectProductionArtifacts([{ ...artifact("release-build-attempt-1"), digest: "" }], 1, "nightly"),
  ).toThrow();
});

test("candidate provenance must match the archive's recorded build", async () => {
  const { requireProductionBuild } = await import("./production-artifacts");
  const identity = { sourceSha: "a".repeat(40), versionSha: "b".repeat(40), toolchain: "bun-1.4.4" };
  expect(() => requireProductionBuild(identity, identity)).not.toThrow();
  expect(() => requireProductionBuild({ ...identity, versionSha: "c".repeat(40) }, identity)).toThrow(
    "Candidate build identity mismatch",
  );
});

test("names policy files the same way on every platform so Windows evidence matches the candidate", () => {
  const files = productionPolicyFiles();
  expect(files).toContain("scripts/ci/production-artifacts.ts");
  expect(files).toContain(".github/workflows/production-validation.yml");
  expect(files).not.toContain("scripts/ci/production-artifacts.p0.test.ts");
});
