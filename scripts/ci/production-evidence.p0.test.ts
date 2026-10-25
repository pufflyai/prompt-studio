import { expect, test } from "bun:test";
import { recordProductionEvidence } from "./production-evidence";

const candidate = {
  artifactRunId: "789",
  artifactAttempt: 1,
  sourceSha: "a".repeat(40),
  versionSha: "b".repeat(40),
  toolchain: "bun-1.4.4",
  policyDigest: "c".repeat(64),
  artifacts: [{ id: 1, name: "release", digest: `sha256:${"d".repeat(64)}` }],
};
test("records the actual consumer checkout and fails a mismatched build", () => {
  expect(
    recordProductionEvidence({
      candidate,
      actualSha: candidate.versionSha,
      toolchain: candidate.toolchain,
      check: "functional",
      outcome: "success",
      runId: "1",
      attempt: 1,
    }),
  ).toMatchObject({ candidate, outcome: "success" });
  expect(() =>
    recordProductionEvidence({
      candidate,
      actualSha: "e".repeat(40),
      toolchain: candidate.toolchain,
      check: "functional",
      outcome: "success",
      runId: "1",
      attempt: 1,
    }),
  ).toThrow("Consumer checkout");
});
