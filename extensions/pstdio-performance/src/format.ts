// People read decimal megabytes; a runtime that grows past 1 GB switches to gigabytes.
export const formatBytes = (bytes: number) =>
  bytes >= 1_000_000_000 ? `${(bytes / 1_000_000_000).toFixed(1)} GB` : `${Math.round(bytes / 1_000_000)} MB`;

// One busy core reads 100%.
export const formatCpu = (percent: number) =>
  `${percent < 10 ? percent.toFixed(1).replace(/\.0$/, "") : Math.round(percent)}%`;

export const formatMs = (ms: number) => `${Math.round(ms)} ms`;
