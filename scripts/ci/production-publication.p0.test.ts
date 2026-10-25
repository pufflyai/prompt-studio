import { expect, test } from "bun:test";
import { requireCertifiedPublication } from "./production-publication";

const candidate = {
  sourceSha: "a".repeat(40),
  versionSha: "b".repeat(40),
  toolchain: "bun-1.4.4",
  policyDigest: "c".repeat(64),
  artifactRunId: "123",
  artifactAttempt: 1,
  artifacts: [
    { id: 1, name: "release-build-attempt-1", digest: `sha256:${"d".repeat(64)}` },
    { id: 2, name: "desktop-win32-x64", digest: `sha256:${"e".repeat(64)}` },
  ],
};
const certificate = { candidate, complete: true, releaseEligible: true };
test("stable publication binds immutable artifact IDs and digests before any writes", () => {
  expect(() =>
    requireCertifiedPublication(
      certificate,
      candidate.artifacts,
      candidate.versionSha,
      candidate.toolchain,
      candidate.policyDigest,
    ),
  ).not.toThrow();
  expect(() =>
    requireCertifiedPublication(
      certificate,
      [{ ...candidate.artifacts[0]!, id: 99 }, candidate.artifacts[1]!],
      candidate.versionSha,
      candidate.toolchain,
      candidate.policyDigest,
    ),
  ).toThrow("changed");
  expect(() =>
    requireCertifiedPublication(
      certificate,
      [candidate.artifacts[0]!, { ...candidate.artifacts[1]!, digest: `sha256:${"f".repeat(64)}` }],
      candidate.versionSha,
      candidate.toolchain,
      candidate.policyDigest,
    ),
  ).toThrow("changed");
  expect(() =>
    requireCertifiedPublication(
      { ...certificate, releaseEligible: false },
      candidate.artifacts,
      candidate.versionSha,
      candidate.toolchain,
      candidate.policyDigest,
    ),
  ).toThrow("complete");
});
