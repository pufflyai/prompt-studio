import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import type { PerformanceRecordingExport } from "pstdio-api-contracts/performance-diagnostics";
import { restoreRecordedCapture, summarizePerformanceEvidence } from "pstdio-diagnostics";
import type { PackagedApp } from "./packaged-app-helpers";
import { readSnapshot } from "./packaged-performance-helpers";

/** Opt in through the real device preference before the measured process is launched. */
export const enableBenchmarkMonitoring = (home: string) => {
  const directory = join(home, "electron-user-data");
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, "performance-monitoring.json"), JSON.stringify({ enabled: true }));
};

export const attachBenchmarkPerformance = async (app: PackagedApp, name: string, endedAt: number) => {
  // Read settling evidence after the operation clock stops. This never changes its budget or workload.
  await expect
    .poll(
      async () => {
        const snapshot = await readSnapshot(app.page);
        if (snapshot?.version !== 2) return false;
        return ["backend", "workbench"].every(
          (role) =>
            snapshot.capture.samples.filter((sample) =>
              sample.processes.some((process) => process.role === role && process.cpuTimeMs !== null),
            ).length >= 2,
        );
      },
      { message: "Benchmark requires backend and workbench CPU/memory capture" },
    )
    .toBe(true);
  const snapshot = await readSnapshot(app.page);
  if (snapshot?.version !== 2) throw new Error("Benchmark requires a version-two performance capture");
  const saved = await app.page.evaluate(() =>
    (
      window as unknown as {
        promptStudioDesktop: { getPerformanceRecordings: () => Promise<PerformanceRecordingExport | null> };
      }
    ).promptStudioDesktop.getPerformanceRecordings(),
  );
  if (!saved) throw new Error("Benchmark recording export is unavailable");
  const capture = restoreRecordedCapture(saved, snapshot.capture);
  const summary = summarizePerformanceEvidence(capture, ["backend", "workbench"]);
  await test.info().attach(`performance-${name}.json`, {
    contentType: "application/json",
    body: JSON.stringify(
      { operation: { startedAt: app.startedAt, endedAt }, readAt: Date.now(), summary, capture },
      null,
      2,
    ),
  });
  expect(summary.failures, "Required performance evidence is missing").toEqual([]);
};
