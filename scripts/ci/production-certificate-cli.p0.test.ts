import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { requiredProductionChecks } from "./production-candidate";

for (const input of ["missing", "unparseable"] as const) {
  test(`preserves the rejection and all unmet requirements when candidate identity is ${input}`, () => {
    const directory = mkdtempSync(join(tmpdir(), "production-rejection-"));
    try {
      const candidate = join(directory, "production-candidate.json");
      if (input === "unparseable") writeFileSync(candidate, "{");
      const result = spawnSync(process.execPath, [join(import.meta.dir, "production-candidate.ts"), candidate], {
        cwd: directory,
        env: {
          ...process.env,
          CHANNEL: "stable",
          GITHUB_STEP_SUMMARY: join(directory, "summary.md"),
          PRODUCTION_RESULTS: JSON.stringify({
            candidate: { result: "failure" },
            functional: { result: "failure" },
            signed_functional: { result: "skipped" },
            performance: { result: "skipped" },
            services: { result: "skipped" },
          }),
        },
        encoding: "utf8",
      });
      expect(result.status).toBe(1);
      const path = join(directory, "production-certificate.json");
      expect(existsSync(path)).toBe(true);
      const certificate = JSON.parse(readFileSync(path, "utf8"));
      expect(certificate).toMatchObject({ candidate: null, complete: false, releaseEligible: false });
      expect(certificate.errors).toContain("candidate: identity unavailable");
      for (const check of requiredProductionChecks("stable")) expect(certificate.errors).toContain(`${check}: missing`);
      for (const [check, outcome] of Object.entries({
        candidate: "failure",
        functional: "failure",
        signed_functional: "skipped",
        performance: "skipped",
        services: "skipped",
      }))
        expect(certificate.errors).toContain(`${check}: ${outcome}`);
      expect(readFileSync(join(directory, "summary.md"), "utf8")).toContain('"releaseEligible": false');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
}

test("preserves complete matching certification through the CLI", () => {
  const directory = mkdtempSync(join(tmpdir(), "production-complete-"));
  try {
    const candidate = {
      sourceSha: "a".repeat(40),
      versionSha: "b".repeat(40),
      toolchain: `bun-${Bun.version}`,
      policyDigest: "c".repeat(64),
      artifactRunId: "789",
      artifactAttempt: 1,
      artifacts: [{ id: 1, name: "desktop-win32-x64", digest: "d".repeat(64) }],
    };
    writeFileSync(join(directory, "production-candidate.json"), JSON.stringify(candidate));
    for (const check of requiredProductionChecks("stable")) {
      const evidence = { candidate, check, outcome: "success", runId: "123", attempt: 1, artifactMode: "published" };
      const path = join(directory, "production-evidence", `${check}.json`);
      mkdirSync(join(directory, "production-evidence"), { recursive: true });
      writeFileSync(path, JSON.stringify(evidence));
    }
    const result = spawnSync(
      process.execPath,
      [join(import.meta.dir, "production-candidate.ts"), "production-candidate.json"],
      {
        cwd: directory,
        env: {
          ...process.env,
          CHANNEL: "stable",
          GITHUB_STEP_SUMMARY: join(directory, "summary.md"),
          PRODUCTION_RESULTS: JSON.stringify(
            Object.fromEntries(
              ["candidate", "functional", "signed_functional", "performance", "services"].map((check) => [
                check,
                { result: "success" },
              ]),
            ),
          ),
        },
        encoding: "utf8",
      },
    );
    expect(result.status).toBe(0);
    expect(JSON.parse(readFileSync(join(directory, "production-certificate.json"), "utf8"))).toMatchObject({
      candidate,
      complete: true,
      releaseEligible: true,
      errors: [],
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
