import { describe, expect, test } from "bun:test";
import type { PerformanceSnapshot } from "@pstdio/sdk/extensions";
import { cpuSources, extensionName, foldSources, keepOrder } from "./cpu-sources";

type PerformanceProcess = PerformanceSnapshot["processes"][number];

// Webview ids are `<publisher>.<extension>.view.<view>`, as the desktop reports them.
const frames = (extension: string, views: number, installedExtensionId = `installed-${extension}`) =>
  Array.from({ length: views }, (_, index) => ({
    installedExtensionId,
    webviewId: `pstdio.${extension}.view.view-${index}`,
  }));

const process = (pid: number, role: PerformanceProcess["role"], cpu: number, extensionFrames = frames("none", 0)) =>
  ({
    pid,
    role,
    name: null,
    extensionFrames,
    cpuPercent: cpu,
    averageCpuPercent: cpu,
    sustainedHighCpu: cpu >= 80,
    idleWakeupsPerSecond: null,
    memoryKiB: { workingSet: 80_000, peakWorkingSet: 90_000, privateBytes: null },
  }) satisfies PerformanceProcess;

const snapshot = (processes: PerformanceProcess[], pausedExtensionIds: string[] = []) =>
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
    pausedExtensionIds,
  }) satisfies PerformanceSnapshot;

const rows = (sources: ReturnType<typeof cpuSources>) =>
  sources.extensions.map((source) => [source.kind, source.name, source.cpuPercent, source.views]);

describe("cpu sources", () => {
  test("names an extension from its webview ids", () => {
    expect(extensionName("pstdio.extension-lab.view.kiln-nav")).toBe("extension-lab");
    expect(extensionName("lab-page")).toBe("lab-page");
  });

  test("lists one row per extension, busiest process first", () => {
    const sources = cpuSources(
      snapshot([
        process(3, "workbench", 104),
        process(4, "extension-frames", 3, frames("notes", 1)),
        process(5, "extension-frames", 34, frames("shader", 2)),
      ]),
    );

    expect(sources.workbench?.cpuPercent).toBe(104);
    expect(rows(sources)).toEqual([
      ["extension", "shader", 34, 2],
      ["extension", "notes", 3, 1],
    ]);
  });

  test("shows a shared process once and lists every extension it hosts, each pausable", () => {
    const sources = cpuSources(
      snapshot([process(5, "extension-frames", 12, [...frames("extension-lab", 3), ...frames("notes", 1)])]),
    );

    expect(rows(sources)).toEqual([
      ["shared", "", 12, 4],
      ["extension", "extension-lab", null, 3],
      ["extension", "notes", null, 1],
    ]);
    expect(sources.extensions.filter((source) => source.installedExtensionId).length).toBe(2);
  });

  test("keeps a paused extension in the list without a process, once", () => {
    const sources = cpuSources(
      snapshot(
        [process(4, "extension-frames", 3, frames("notes", 1)), process(5, "extension-frames", 9, frames("shader", 1))],
        ["installed-shader"],
      ),
    );

    expect(sources.extensions.map((source) => [source.key, source.paused])).toEqual([
      ["installed-notes", false],
      ["installed-shader", true],
    ]);
  });

  test("keeps a resumed extension until its next process sample arrives", () => {
    const paused = cpuSources(snapshot([], ["installed-shader"]));
    const waiting = cpuSources(snapshot([]), paused.extensions);
    expect(waiting.extensions).toMatchObject([
      { key: "installed-shader", paused: false, resuming: true, cpuPercent: null, memoryKiB: null, views: 0 },
    ]);
    const stillWaiting = cpuSources(snapshot([]), waiting.extensions);
    expect(stillWaiting.extensions).toEqual(waiting.extensions);
    const running = cpuSources(
      snapshot([process(5, "extension-frames", 9, frames("shader", 1))]),
      stillWaiting.extensions,
    );
    expect(rows(running)).toEqual([["extension", "shader", 9, 1]]);
    expect(cpuSources(snapshot([]), running.extensions).extensions).toEqual([]);
    expect(cpuSources(null, waiting.extensions).extensions).toEqual([]);
  });

  test("folds rows after the five busiest and adds up their CPU", () => {
    const processes = [7, 6, 5, 4, 3, 2, 1].map((cpu) =>
      process(cpu + 10, "extension-frames", cpu, frames(`ext-${cpu}`, 1)),
    );
    const { extensions } = cpuSources(snapshot(processes));

    expect(foldSources(extensions, false)).toMatchObject({ hidden: 2, hiddenCpuPercent: 3 });
    expect(foldSources(extensions, true).shown).toHaveLength(7);
  });

  test("keeps a frozen order and adds new rows after it", () => {
    const { extensions } = cpuSources(
      snapshot(
        [
          process(5, "extension-frames", 34, frames("shader", 1)),
          process(6, "extension-frames", 3, frames("notes", 1)),
        ],
        ["installed-radar"],
      ),
    );

    expect(keepOrder(extensions, ["installed-notes", "installed-shader"]).map((source) => source.key)).toEqual([
      "installed-notes",
      "installed-shader",
      "installed-radar",
    ]);
  });
});
