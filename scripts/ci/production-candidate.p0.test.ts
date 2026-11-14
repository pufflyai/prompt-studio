import { expect, test } from "bun:test";
import {
  certifyProduction,
  type ProductionCandidate,
  requiredProductionChecks,
  selectProductionEvidence,
} from "./production-candidate";

const candidate: ProductionCandidate = {
  artifactRunId: "789",
  artifactAttempt: 1,
  sourceSha: "a".repeat(40),
  versionSha: "b".repeat(40),
  toolchain: "bun-1.4.4",
  policyDigest: "c".repeat(64),
  artifacts: [{ id: 1, name: "release", digest: "d".repeat(64) }],
};
const report = (check: string, outcome = "success") => ({
  candidate,
  check,
  outcome,
  runId: "123",
  attempt: 1,
  artifactMode: "published" as const,
});

test("certifies only complete exact candidate evidence", () => {
  expect(
    certifyProduction(
      candidate,
      ["P0", "P1", "P2", "P3"],
      ["P0", "P1", "P2", "P3"].map((key) => report(key)),
    ),
  ).toEqual([]);
});

test("rejects stale source, generated version, toolchain, policy, and artifact evidence", () => {
  for (const field of ["sourceSha", "versionSha", "toolchain", "policyDigest"] as const) {
    expect(
      certifyProduction(candidate, ["P2"], [{ ...report("P2"), candidate: { ...candidate, [field]: "stale" } }]),
    ).toContain("P2: candidate mismatch");
  }
  expect(
    certifyProduction(candidate, ["P2"], [{ ...report("P2"), candidate: { ...candidate, artifacts: [] } }]),
  ).toContain("P2: candidate mismatch");
});

test("aggregates missing, skipped and failed checks rather than passing a partial diagnostic", () => {
  expect(
    certifyProduction(
      candidate,
      ["P0", "P1", "P2", "P3"],
      [report("P0"), report("P1", "failure"), report("P2", "skipped")],
    ),
  ).toEqual(["P1: failure", "P2: skipped", "P3: missing"]);
});

test("never certifies empty requirements, missing artifacts or ambiguous evidence", () => {
  expect(certifyProduction(candidate, [], [])).not.toEqual([]);
  expect(certifyProduction({ ...candidate, artifacts: [] }, ["P0"], [report("P0")])).not.toEqual([]);
  expect(certifyProduction(candidate, ["P0"], [report("P0"), report("P0", "failure")])).not.toEqual([]);
});

test("source-only nightly Windows diagnostics cannot certify signed stable Windows bytes", () => {
  const stable = {
    ...candidate,
    artifacts: [...candidate.artifacts, { id: 2, name: "desktop-win32-x64", digest: "e".repeat(64) }],
  };
  expect(
    certifyProduction(
      stable,
      ["windows"],
      [{ ...report("windows"), candidate: stable, artifactMode: "source-diagnostic" }],
    ),
  ).toContain("windows: a source diagnostic cannot certify a stable publication artifact");
});

test("stable releases certify every published host while the nightly certifies Linux and Apple Silicon", () => {
  const stable = requiredProductionChecks("stable");
  const nightly = requiredProductionChecks("nightly");
  for (const target of ["darwin-x64", "win32-x64"]) {
    expect(stable).toContain(`desktop-${target === "linux-x64" ? "shared" : "native"}-${target}`);
    expect(stable).toContain(`performance-desktop-${target}`);
  }
  for (const suite of ["storage", "runtime"])
    for (const os of ["ubuntu-24.04", "macos-15", "windows-2025"])
      expect(stable).toContain(`performance-${suite}-${os}`);
  expect(nightly.filter((check) => /win32|windows|darwin-x64/.test(check))).toEqual([]);
  expect(nightly).toContain("performance-storage-macos-15");
  expect(nightly).toContain("desktop-native-darwin-arm64");
});

test("production reruns retain matching successful attestations and the newest failed result remains blocking", () => {
  const observations = [report("functional"), report("browser", "failure"), { ...report("browser"), attempt: 2 }];
  const selected = selectProductionEvidence(candidate, observations, "123", 2);
  expect(selected.errors).toEqual([]);
  expect(certifyProduction(candidate, ["functional", "browser"], selected.evidence)).toEqual([]);
  expect(selected.evidence.find((entry) => entry.check === "functional")?.attempt).toBe(1);
  const failed = selectProductionEvidence(
    candidate,
    [report("browser"), { ...report("browser", "failure"), attempt: 2 }],
    "123",
    2,
  );
  expect(certifyProduction(candidate, ["browser"], failed.evidence)).toEqual(["browser: failure"]);
});

test("production reruns reject cross-run, future, mixed-candidate and duplicate-attempt attestations", () => {
  for (const extra of [
    { ...report("functional"), runId: "other" },
    { ...report("functional"), attempt: 3 },
    { ...report("functional"), candidate: { ...candidate, versionSha: "e".repeat(40) } },
    report("functional"),
  ])
    expect(selectProductionEvidence(candidate, [report("functional"), extra], "123", 2).errors.length).toBeGreaterThan(
      0,
    );
});
