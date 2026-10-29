import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect } from "@playwright/test";
import type { PerformanceCapture } from "pstdio-api-contracts/performance-diagnostics";
import { test } from "../testing/packaged-fixture";
import { attachBenchmarkPerformance, enableBenchmarkMonitoring } from "./benchmark-performance-evidence";
import { createPackagedHome, disposePackagedApp, launchPackagedApp } from "./packaged-app-helpers";

test("retains available capture history when required settling evidence is missing", async () => {
  const home = createPackagedHome();
  enableBenchmarkMonitoring(home);
  const app = await launchPackagedApp(home, { PSTDIO_DEFAULT_EXTENSIONS: "[]" });
  try {
    // The requested boundary cannot settle during the existing five-second poll.
    const failure = await attachBenchmarkPerformance(app, "incomplete-settling", Date.now() + 60_000).catch(
      (error: unknown) => error,
    );
    expect(failure).toBeInstanceOf(Error);
    const attachment = test.info().attachments.find((item) => item.name === "performance-incomplete-settling.json");
    expect(attachment).toBeDefined();
    const body = attachment!.body ?? readFileSync(attachment!.path!);
    const evidence = JSON.parse(body.toString()) as { capture: PerformanceCapture; failure: string };
    expect(evidence.capture.samples.length).toBeGreaterThan(0);
    expect(evidence.capture.samples.some((sample) => sample.sequence === 0)).toBe(true);
    expect(
      evidence.capture.samples.some((sample) => sample.processes.some((process) => process.role === "backend")),
    ).toBe(true);
    expect(evidence.failure).toBe(String(failure));
  } finally {
    await disposePackagedApp(app);
  }
});

test("retains saved recordings after the live capture becomes unavailable", async () => {
  const home = createPackagedHome();
  enableBenchmarkMonitoring(home);
  const app = await launchPackagedApp(home, { PSTDIO_DEFAULT_EXTENSIONS: "[]" });
  try {
    await app.page.evaluate(() => window.promptStudioDesktop.setPerformanceMonitoring(false));
    const failure = await attachBenchmarkPerformance(app, "stopped-capture", Date.now()).catch(
      (error: unknown) => error,
    );
    expect(failure).toBeInstanceOf(Error);
    const attachment = test.info().attachments.find((item) => item.name === "performance-stopped-capture-partial.json");
    expect(attachment).toBeDefined();
    const body = attachment!.body ?? readFileSync(attachment!.path!);
    const evidence = JSON.parse(body.toString()) as {
      snapshot: unknown;
      recordings: { files: { content: string }[] };
      failure: string;
    };
    expect(evidence.snapshot).toBeNull();
    const records = evidence.recordings.files.flatMap((file) =>
      file.content
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line)),
    );
    expect(records.some((record) => record.kind === "sample")).toBe(true);
    expect(evidence.failure).toBe(String(failure));
  } finally {
    await disposePackagedApp(app);
  }
});

test("exports complete evidence after the settling requirement is met", async () => {
  const home = createPackagedHome();
  enableBenchmarkMonitoring(home);
  const app = await launchPackagedApp(home, { PSTDIO_DEFAULT_EXTENSIONS: "[]" });
  try {
    await test
      .info()
      .attach("startup-probe.json", { path: join(home, "startup-probe.json"), contentType: "application/json" });
    await attachBenchmarkPerformance(app, "completed-settling", Date.now());
    const attachment = test.info().attachments.find((item) => item.name === "performance-completed-settling.json");
    expect(attachment).toBeDefined();
    const body = attachment!.body ?? readFileSync(attachment!.path!);
    const evidence = JSON.parse(body.toString()) as { summary: { failures: string[] }; capture: PerformanceCapture };
    expect(evidence.summary.failures).toEqual([]);
    expect(evidence.capture.samples.length).toBeGreaterThan(0);
  } finally {
    await disposePackagedApp(app);
  }
});
