import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { productionPolicyDigest } from "./production-artifacts";
import { describeProductionPayload } from "./production-payload";

test("consumer attestation uses the immutable candidate without relisting a changing artifact inventory", async () => {
  const directory = mkdtempSync(join(tmpdir(), "consumer-attestation-"));
  const git = (args: string[]) => spawnSync("git", args, { cwd: import.meta.dir, encoding: "utf8" }).stdout.trim();
  try {
    const names = [
      "release-build-attempt-1",
      ...["linux-x64", "darwin-arm64", "darwin-x64", "win32-x64"].flatMap((target) => [
        `desktop-${target}`,
        `validation-app-${target}`,
      ]),
      "service-container-relay",
      "service-container-account-manager",
    ];
    const candidate = {
      sourceSha: "a".repeat(40),
      versionSha: git(["rev-parse", "HEAD"]),
      toolchain: `bun-${Bun.version}`,
      policyDigest: productionPolicyDigest(),
      artifactRunId: "789",
      artifactAttempt: 1,
      artifacts: names.map((name, index) => ({ id: index + 1, name, digest: `sha256:${"d".repeat(64)}` })),
    };
    const payloadName = join(directory, "payload.tar.gz");
    writeFileSync(payloadName, "exact consumer bytes");
    const payload = await describeProductionPayload(payloadName);
    writeFileSync(join(directory, "production-build-identity.json"), JSON.stringify({ ...candidate, ...payload }));
    const invoke = (manifest: typeof candidate) => {
      writeFileSync(join(directory, "production-candidate.json"), JSON.stringify(manifest));
      return spawnSync(
        process.execPath,
        [
          join(import.meta.dir, "production-evidence.ts"),
          "--check",
          "performance-runtime-ubuntu-24.04",
          "--outcome",
          "success",
        ],
        {
          cwd: directory,
          encoding: "utf8",
          env: {
            ...process.env,
            GIT_DIR: git(["rev-parse", "--absolute-git-dir"]),
            GH_HOST: "127.0.0.1:1",
            GH_TOKEN: "unavailable",
            GITHUB_RUN_ID: "123",
            GITHUB_RUN_ATTEMPT: "2",
            GITHUB_REPOSITORY: "unavailable/repository",
            ARTIFACT_RUN_ID: candidate.artifactRunId,
            ARTIFACT_ATTEMPT: "1",
            SOURCE_SHA: candidate.sourceSha,
            CHANNEL: "stable",
          },
        },
      );
    };
    const valid = invoke(candidate);
    expect(valid.stderr).toBe("");
    expect(valid.status).toBe(0);
    expect(
      JSON.parse(readFileSync(join(directory, "production-evidence/performance-runtime-ubuntu-24.04.json"), "utf8")),
    ).toMatchObject({ candidate, runId: "123", attempt: 2, artifactMode: "published", outcome: "success" });
    for (const changed of [
      { artifactRunId: "790" },
      { artifactAttempt: 2 },
      { sourceSha: "b".repeat(40) },
      { policyDigest: "c".repeat(64) },
      { versionSha: "b".repeat(40) },
      { toolchain: "another-runtime" },
      { artifacts: candidate.artifacts.slice(1) },
    ])
      expect(invoke({ ...candidate, ...changed }).status).toBe(1);
    writeFileSync(payloadName, "altered consumer bytes");
    expect(invoke(candidate).status).toBe(1);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
