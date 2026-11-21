import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const candidate = {
  sourceSha: "a".repeat(40),
  versionSha: "b".repeat(40),
  toolchain: "bun-test",
  policyDigest: "c".repeat(64),
  artifactRunId: "123",
  artifactAttempt: 1,
  artifacts: [{ id: 1, name: "desktop-win32-x64", digest: "d".repeat(64) }],
};
const functionalChecks = [
  "functional",
  "services",
  "project-upgrade-linux-x64",
  "project-upgrade-darwin-arm64",
  "desktop-shared-linux-x64",
  "desktop-native-darwin-arm64",
  "desktop-native-darwin-x64",
  "desktop-native-win32-x64",
];

test.each([
  "absent",
  "failed",
  "functional-failure",
  "functional-identity",
] as const)("release certification with %s performance observations", async (mode) => {
  const directory = await mkdtemp(join(tmpdir(), "pstdio-release-advisory-"));
  try {
    await writeFile(join(directory, "candidate.json"), JSON.stringify(candidate));
    await mkdir(join(directory, "production-evidence"));
    const observations = functionalChecks.map((check) => ({
      candidate,
      check,
      outcome: mode === "functional-failure" && check === "functional" ? "failure" : "success",
      runId: "123",
      attempt: 1,
      artifactMode: "published",
    }));
    if (mode === "functional-identity") observations[0]!.candidate = { ...candidate, versionSha: "e".repeat(40) };
    if (mode === "failed")
      observations.push({
        candidate,
        check: "performance-storage-ubuntu-24.04",
        outcome: "failure",
        runId: "123",
        attempt: 1,
        artifactMode: "published",
      });
    for (const [index, evidence] of observations.entries())
      await writeFile(join(directory, "production-evidence", `${index}.json`), JSON.stringify(evidence));
    const results = Object.fromEntries(
      ["candidate", "functional", "signed_functional", "services", "project_upgrade"].map((name) => [
        name,
        { result: "success" },
      ]),
    );
    const child = Bun.spawn(["bun", resolve(import.meta.dirname, "production-candidate.ts"), "candidate.json"], {
      cwd: directory,
      env: {
        ...process.env,
        PRODUCTION_RESULTS: JSON.stringify(results),
        CHANNEL: "stable",
        GITHUB_RUN_ID: "123",
        GITHUB_RUN_ATTEMPT: "1",
        GITHUB_STEP_SUMMARY: undefined,
      },
      stdout: "ignore",
      stderr: "pipe",
    });
    const errors = await new Response(child.stderr).text();
    const exit = await child.exited;
    const certificate = JSON.parse(await readFile(join(directory, "production-certificate.json"), "utf8"));
    if (mode === "functional-failure" || mode === "functional-identity") {
      expect(exit).toBe(1);
      expect(certificate.releaseEligible).toBe(false);
      expect(errors).toContain(
        mode === "functional-failure" ? "functional: failure" : "functional: candidate mismatch",
      );
    } else {
      expect(errors).toBe("");
      expect(exit).toBe(0);
      expect(certificate.complete).toBe(true);
      expect(certificate.releaseEligible).toBe(true);
      if (mode === "failed")
        expect(certificate.observations).toContainEqual(
          expect.objectContaining({ check: "performance-storage-ubuntu-24.04", outcome: "failure" }),
        );
    }
  } finally {
    await rm(directory, { recursive: true });
  }
});
