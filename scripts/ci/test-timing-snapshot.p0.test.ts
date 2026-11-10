import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compatibleTestTimings, readTestTimingSnapshot } from "./test-timing-snapshot";

test("timing observations require matching provenance, host, profile and fresh configuration", () => {
  const root = mkdtempSync(join(tmpdir(), "timings-"));
  try {
    const file = join(root, "timings.json");
    const observation = {
      kind: "file",
      key: join(root, "packages/owner/case.p0.test.ts"),
      profile: "owner/bun",
      host: "linux/x64",
      configuration: "source:stable:P0",
      coverage: false,
      durationMs: 10,
      samples: 3,
      observedAt: "2026-11-10T00:00:00Z",
      sourceSha: "baseline",
      provenance: "first-attempt/run/1",
    };
    const write = (patch = {}) =>
      writeFileSync(
        file,
        JSON.stringify({
          version: 1,
          capturedAt: "2026-11-11T00:00:00Z",
          observations: [{ ...observation, ...patch }],
        }),
      );
    const context = {
      kind: "file" as const,
      profile: observation.profile,
      host: observation.host,
      configuration: observation.configuration,
      coverage: false,
    };
    write();
    const snapshot = readTestTimingSnapshot(file, root);
    expect(compatibleTestTimings(snapshot, context)).toEqual({ "packages/owner/case.p0.test.ts": 10 });
    expect(compatibleTestTimings(snapshot, { ...context, coverage: true })).toEqual({});
    expect(compatibleTestTimings(snapshot, { ...context, host: "darwin/arm64" })).toEqual({});
    write({ observedAt: "2026-01-01T00:00:00Z" });
    expect(compatibleTestTimings(readTestTimingSnapshot(file, root), context)).toEqual({});
    write({ provenance: "" });
    expect(() => readTestTimingSnapshot(file, root)).toThrow();
    write({ key: "../outside" });
    expect(() => readTestTimingSnapshot(file, root)).toThrow();
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
