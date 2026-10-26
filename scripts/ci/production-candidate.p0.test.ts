import { expect, test } from "bun:test";
import { certifyProduction, type ProductionCandidate, requiredProductionChecks } from "./production-candidate";

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

test("full releases require Intel functional and performance proof while nightly retains Windows", () => {
  const stable = requiredProductionChecks("stable");
  const nightly = requiredProductionChecks("nightly");
  expect(stable).toContain("signed-functional-darwin-x64");
  expect(stable).toContain("performance-desktop-darwin-x64");
  expect(nightly).not.toContain("signed-functional-darwin-x64");
  expect(nightly).toContain("signed-functional-win32-x64");
});

test("only stable releases require P3 performance proof", () => {
  const performance = (checks: string[]) => checks.filter((check) => check.startsWith("performance-"));
  expect(performance(requiredProductionChecks("stable"))).toContain("performance-navigation-ubuntu-24.04");
  expect(performance(requiredProductionChecks("stable"))).toContain("performance-desktop-win32-x64");
  expect(performance(requiredProductionChecks("nightly"))).toEqual([]);
});
