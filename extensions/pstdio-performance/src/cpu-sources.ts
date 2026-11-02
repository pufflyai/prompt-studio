import type { PerformanceSnapshot } from "@pstdio/sdk/extensions";

type PerformanceProcess = PerformanceSnapshot["processes"][number];

export const SHOWN_EXTENSIONS = 5;

// One row in the popover's CPU list. Chromium usually runs every extension view in one
// shared process, and its CPU cannot be split between them. That process gets one
// `shared` row with the total, followed by one row per extension it hosts.
export interface CpuSource {
  // The install id for an extension, so its row keeps its place while it runs or pauses.
  key: string;
  kind: "workbench" | "extension" | "shared";
  installedExtensionId?: string;
  // `<publisher>.<name>`, when the extension's views have told us.
  extensionId?: string;
  name: string;
  views: number;
  cpuPercent: number | null;
  memoryKiB: number | null;
  paused: boolean;
  resuming?: boolean;
}

// Webview ids are `<publisher>.<extension>.view.<view>`: the only readable extension
// identity in the public snapshot.
const VIEW_ID = /^([^.]+)\.(.+?)\.view\./;

export const extensionName = (webviewId: string) => webviewId.match(VIEW_ID)?.[2] ?? webviewId;

const extensionIdOf = (webviewId: string) => {
  const match = webviewId.match(VIEW_ID);
  return match ? `${match[1]}.${match[2]}` : undefined;
};

const extensionsIn = (process: PerformanceProcess) => {
  const byInstall = new Map<string, { webviewId: string; views: number }>();
  for (const frame of process.extensionFrames) {
    const entry = byInstall.get(frame.installedExtensionId);
    byInstall.set(frame.installedExtensionId, {
      webviewId: entry?.webviewId ?? frame.webviewId,
      views: (entry?.views ?? 0) + 1,
    });
  }
  return [...byInstall];
};

const processRows = (process: PerformanceProcess, paused: ReadonlySet<string>): CpuSource[] => {
  const cpuPercent = process.averageCpuPercent ?? process.cpuPercent;
  const memoryKiB = process.memoryKiB.workingSet;
  // A paused extension's process can linger for a few seconds; it shows as paused only.
  const running = extensionsIn(process).filter(([installedExtensionId]) => !paused.has(installedExtensionId));
  const extensionRow = ([installedExtensionId, entry]: (typeof running)[number], own: boolean): CpuSource => ({
    key: installedExtensionId,
    kind: "extension",
    installedExtensionId,
    extensionId: extensionIdOf(entry.webviewId),
    name: extensionName(entry.webviewId),
    views: entry.views,
    cpuPercent: own ? cpuPercent : null,
    memoryKiB: own ? memoryKiB : null,
    paused: false,
  });
  if (running.length === 1) return [extensionRow(running[0]!, true)];
  if (running.length === 0) return [];
  return [
    {
      key: `process:${process.pid}`,
      kind: "shared",
      name: "",
      views: running.reduce((total, [, entry]) => total + entry.views, 0),
      cpuPercent,
      memoryKiB,
      paused: false,
    },
    ...running.map((entry) => extensionRow(entry, false)),
  ];
};

// An extension is listed while one of its views runs in a measured process, or while it is paused.
export const cpuSources = (snapshot: PerformanceSnapshot | null | undefined, previous: readonly CpuSource[] = []) => {
  const processes = snapshot?.processes ?? [];
  const paused = new Set(snapshot?.pausedExtensionIds ?? []);
  const workbench = processes.find((process) => process.role === "workbench");
  const running = processes
    .filter((process) => process.role === "extension-frames")
    .sort((left, right) => (right.averageCpuPercent ?? right.cpuPercent) - (left.averageCpuPercent ?? left.cpuPercent))
    .flatMap((process) => processRows(process, paused));
  const pausedSources = [...paused].map(
    (installedExtensionId): CpuSource => ({
      key: installedExtensionId,
      kind: "extension",
      installedExtensionId,
      name: "",
      views: 0,
      cpuPercent: null,
      memoryKiB: null,
      paused: true,
    }),
  );
  return {
    workbench: workbench
      ? {
          cpuPercent: workbench.averageCpuPercent ?? workbench.cpuPercent,
          memoryKiB: workbench.memoryKiB.workingSet,
        }
      : null,
    extensions: [
      ...running,
      ...pausedSources,
      // Pause state arrives before the next measured process sample. Keep the row while
      // resumed views restart, without presenting their old CPU or memory as a new sample.
      ...(snapshot
        ? previous
            .filter(
              (source) =>
                (source.paused || source.resuming) &&
                !paused.has(source.key) &&
                !running.some((row) => row.key === source.key),
            )
            .map((source) => ({
              ...source,
              paused: false,
              resuming: true,
              views: 0,
              cpuPercent: null,
              memoryKiB: null,
            }))
        : []),
    ],
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
// cursor never changes. Rows that appear meanwhile go after the frozen rows.
export const keepOrder = (extensions: CpuSource[], order: readonly string[] | null) => {
  if (!order) return extensions;
  const position = (source: CpuSource) => {
    const index = order.indexOf(source.key);
    return index === -1 ? order.length : index;
  };
  return [...extensions].sort((left, right) => position(left) - position(right));
};
