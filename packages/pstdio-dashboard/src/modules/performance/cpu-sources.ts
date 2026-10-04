import type { PerformanceProcess, PerformanceSnapshot } from "pstdio-api-contracts/performance-diagnostics";

export const SHOWN_EXTENSIONS = 5;

// One row in the popover's CPU list: the workbench window, or a process that
// runs extension views. Chromium may run several extensions in one process,
// so a row lists every extension that its process hosts.
export interface CpuSource {
  // The extension ids, so a row keeps its identity while it runs, waits, or pauses.
  key: string;
  installedExtensionIds: string[];
  views: number;
  cpuPercent: number | null;
  memoryKiB: number | null;
  sustainedHighCpu: boolean;
  paused: boolean;
}

const fromProcess = (process: PerformanceProcess): CpuSource => {
  const installedExtensionIds = [...new Set(process.extensionFrames.map((frame) => frame.installedExtensionId))];
  return {
    key: process.role === "workbench" ? "workbench" : installedExtensionIds.join(","),
    installedExtensionIds,
    views: process.extensionFrames.length,
    cpuPercent: process.averageCpuPercent ?? process.cpuPercent,
    memoryKiB: process.memoryKiB.workingSet,
    sustainedHighCpu: process.sustainedHighCpu,
    paused: false,
  };
};

// An extension is listed while it has a process, an open view, or a pause. Open
// views without a measured process, as in a browser tab, show no number.
export const cpuSources = (
  snapshot: PerformanceSnapshot | null | undefined,
  paused: ReadonlySet<string>,
  openViews: ReadonlyMap<string, number>,
) => {
  const processes = snapshot?.processes ?? [];
  const workbench = processes.find((process) => process.role === "workbench");
  const running = processes
    .filter((process) => process.role === "extension-frames")
    .map(fromProcess)
    // A paused extension's process can linger for a few seconds; show it as paused only.
    .filter((source) => !source.installedExtensionIds.every((id) => paused.has(id)))
    .sort((left, right) => (right.cpuPercent ?? 0) - (left.cpuPercent ?? 0));
  const measured = new Set(running.flatMap((source) => source.installedExtensionIds));
  const unmeasured = [...openViews]
    .filter(([installedExtensionId]) => !measured.has(installedExtensionId) && !paused.has(installedExtensionId))
    .map(
      ([installedExtensionId, views]): CpuSource => ({
        key: installedExtensionId,
        installedExtensionIds: [installedExtensionId],
        views,
        cpuPercent: null,
        memoryKiB: null,
        sustainedHighCpu: false,
        paused: false,
      }),
    );
  const pausedSources = [...paused].map(
    (installedExtensionId): CpuSource => ({
      key: installedExtensionId,
      installedExtensionIds: [installedExtensionId],
      views: 0,
      cpuPercent: null,
      memoryKiB: null,
      sustainedHighCpu: false,
      paused: true,
    }),
  );
  return {
    workbench: workbench ? fromProcess(workbench) : null,
    extensions: [...running, ...unmeasured, ...pausedSources],
  };
};

export const foldSources = (extensions: CpuSource[], expanded: boolean) => {
  const shown = expanded ? extensions : extensions.slice(0, SHOWN_EXTENSIONS);
  const rest = extensions.slice(shown.length);
  return {
    shown,
    hidden: rest.length,
    hiddenCpuPercent: rest.reduce((total, source) => total + (source.cpuPercent ?? 0), 0),
  };
};

// While a person points at the list, rows keep their places so the row under the
// cursor never changes. Extensions that appear meanwhile go after the frozen rows.
export const keepOrder = (extensions: CpuSource[], order: readonly string[] | null) => {
  if (!order) return extensions;
  const position = (source: CpuSource) => {
    const index = order.indexOf(source.key);
    return index === -1 ? order.length : index;
  };
  return [...extensions].sort((left, right) => position(left) - position(right));
};
