import { beforeAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PerformanceCapture } from "pstdio-api-contracts/performance-diagnostics";
import { createObservedScaleRuntime } from "../perf/storage-scale-performance";
import { buildBinary } from "./packaged-helpers";
import { registerPerformanceSmokeTests } from "./packaged-performance-smoke";
import { PACKAGED_TEST_TIMEOUT } from "./packaged-test-timeout";

beforeAll(buildBinary);
registerPerformanceSmokeTests();

test(
  "captures scale startup before readiness and preserves separate runtime artifacts",
  async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-scale-evidence-"));
    const files: string[] = [];
    try {
      for (let index = 0; index < 2; index++) {
        const home = join(root, `home-${index}`);
        mkdirSync(home);
        // Separate factories match the independent case processes used by the real benchmark.
        const observed = createObservedScaleRuntime(root, (row) => {
          if ("file" in row && typeof row.file === "string") files.push(row.file);
        });
        const runtime = await observed.start(home);
        await runtime.stop();
        expect(observed.failures).toEqual([]);
      }
      expect(new Set(files).size).toBe(2);
      for (const file of files) {
        const { capture, summary } = JSON.parse(readFileSync(join(root, file), "utf8")) as {
          capture: PerformanceCapture;
          summary: { settling: { operationEndedAt: string; minimumIdleMs: number } };
        };
        expect(Date.parse(capture.samples.at(-1)!.capturedAt)).toBeGreaterThanOrEqual(
          Date.parse(summary.settling.operationEndedAt) + summary.settling.minimumIdleMs,
        );
        expect(capture.samples.some((sample) => sample.backend.runtimeId === null && sample.processes.length > 0)).toBe(
          true,
        );
        expect(capture.samples.some((sample) => sample.backend.state === "reply")).toBe(true);
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  },
  PACKAGED_TEST_TIMEOUT,
);
