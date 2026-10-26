import { describe, expect, test } from "bun:test";
import type { PerformanceProcess, PerformanceSnapshot } from "pstdio-api-contracts/performance-diagnostics";
import { cpuSources, foldSources, keepOrder } from "./cpu-sources";

const process = (pid: number, role: PerformanceProcess["role"], cpu: number, extensions: string[] = []) =>
  ({
    pid,
    role,
    name: null,
    extensionFrames: extensions.map((installedExtensionId) => ({ installedExtensionId, webviewId: "main" })),
    cpuPercent: cpu,
    averageCpuPercent: cpu,
    sustainedHighCpu: cpu >= 80,
    idleWakeupsPerSecond: null,
    memoryKiB: { workingSet: 80_000, peakWorkingSet: 90_000, privateBytes: null },
  }) satisfies PerformanceProcess;

const snapshot = (processes: PerformanceProcess[]) =>
  ({
    version: 1,
    host: "desktop",
    capturedAt: new Date(0).toISOString(),
    sampleIntervalMs: 2000,
    warning: { windowMs: 30_000, cpuPercent: 80 },
    measurementWindowMs: 2000,
    capabilities: { processMetrics: true, idleWakeups: true, privateMemory: false, slowFrames: null },
    processes,
    frames: [],
    frameRate: [],
    pausedExtensionIds: [],
  }) satisfies PerformanceSnapshot;

describe("cpu sources", () => {
  test("lists the workbench and one row per extension process, busiest extension first", () => {
    const sources = cpuSources(
      snapshot([
        process(1, "main", 2),
        process(2, "gpu", 9),
        process(3, "workbench", 104),
        process(4, "extension-frames", 3, ["notes"]),
        process(5, "extension-frames", 34, ["shader", "shader"]),
      ]),
      new Set(),
      new Map(),
    );

    expect(sources.workbench?.cpuPercent).toBe(104);
    expect(sources.extensions.map((source) => [source.installedExtensionIds, source.cpuPercent, source.views])).toEqual(
      [
        [["shader"], 34, 2],
        [["notes"], 3, 1],
      ],
    );
  });

  test("keeps a paused extension in the list without a process", () => {
    const sources = cpuSources(
      snapshot([process(4, "extension-frames", 3, ["notes"])]),
      new Set(["shader"]),
      new Map(),
    );

    expect(sources.extensions.map((source) => [source.installedExtensionIds, source.paused])).toEqual([
      [["notes"], false],
      [["shader"], true],
    ]);
  });

  test("folds extensions after the five busiest and adds up their CPU", () => {
    const processes = [7, 6, 5, 4, 3, 2, 1].map((cpu) => process(cpu + 10, "extension-frames", cpu, [`ext-${cpu}`]));
    const { extensions } = cpuSources(snapshot(processes), new Set(), new Map());

    expect(foldSources(extensions, false)).toMatchObject({ hidden: 2, hiddenCpuPercent: 3 });
    expect(foldSources(extensions, false).shown).toHaveLength(5);
    expect(foldSources(extensions, true).shown).toHaveLength(7);
  });

  test("lists open extension views without a number until their process is measured", () => {
    const sources = cpuSources(
      snapshot([process(4, "extension-frames", 3, ["notes"])]),
      new Set(),
      new Map([
        ["notes", 1],
        ["radar", 2],
      ]),
    );

    expect(sources.extensions.map((source) => [source.installedExtensionIds, source.cpuPercent, source.views])).toEqual(
      [
        [["notes"], 3, 1],
        [["radar"], null, 2],
      ],
    );
  });

  test("lists open extension views in a browser tab, where no process is measured", () => {
    const sources = cpuSources(null, new Set(), new Map([["notes", 1]]));

    expect(sources.workbench).toBeNull();
    expect(sources.extensions.map((source) => [source.installedExtensionIds, source.cpuPercent])).toEqual([
      [["notes"], null],
    ]);
  });

  test("shows a paused extension once, even before its process has exited", () => {
    const sources = cpuSources(
      snapshot([process(5, "extension-frames", 34, ["shader"])]),
      new Set(["shader"]),
      new Map(),
    );

    expect(sources.extensions.map((source) => [source.installedExtensionIds, source.paused])).toEqual([
      [["shader"], true],
    ]);
  });

  test("gives an extension the same row key whether it runs, waits for a sample, or is paused", () => {
    const running = cpuSources(snapshot([process(5, "extension-frames", 34, ["shader"])]), new Set(), new Map());
    const paused = cpuSources(snapshot([]), new Set(["shader"]), new Map());
    const reopened = cpuSources(snapshot([]), new Set(), new Map([["shader", 1]]));

    expect(new Set([running, paused, reopened].map((sources) => sources.extensions[0]?.key))).toEqual(
      new Set(["shader"]),
    );
  });

  test("keeps a frozen order and adds new extensions after it", () => {
    const { extensions } = cpuSources(
      snapshot([process(5, "extension-frames", 34, ["shader"]), process(6, "extension-frames", 3, ["notes"])]),
      new Set(),
      new Map([["radar", 1]]),
    );

    expect(keepOrder(extensions, ["notes", "shader"]).map((source) => source.key)).toEqual([
      "notes",
      "shader",
      "radar",
    ]);
    expect(keepOrder(extensions, null).map((source) => source.key)).toEqual(["shader", "notes", "radar"]);
  });
});
