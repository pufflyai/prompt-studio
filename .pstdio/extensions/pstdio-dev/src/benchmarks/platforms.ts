// Shared by commands and webviews, so it holds plain data only.
export const PLATFORMS = [
  { id: "linux-x64", label: "Linux x64" },
  { id: "darwin-arm64", label: "macOS arm64" },
  { id: "darwin-x64", label: "macOS x64" },
  { id: "win32-x64", label: "Windows x64" },
] as const;

// Linux runners are the cheapest and most stable, so runs and pages start there.
export const DEFAULT_PLATFORM = "linux-x64";

export const platformLabel = (id: string) => PLATFORMS.find((platform) => platform.id === id)?.label ?? id;

// Mirrors the suite list in packages/benchmarks, which this extension cannot import. Minutes are rough
// per-sample costs on a Linux runner, used only to estimate a run's length.
export const SUITES = [
  { id: "desktop", label: "Desktop app", minutes: 3 },
  { id: "workbench", label: "Workbench interactions", minutes: 4 },
  { id: "chat", label: "Chat rendering", minutes: 3 },
  { id: "subnav", label: "Side navigation", minutes: 2 },
  { id: "planner", label: "Planner board", minutes: 1 },
  { id: "storage", label: "Storage", minutes: 1 },
  { id: "runtime", label: "Runtime", minutes: 1 },
  { id: "relay", label: "Relay storage", minutes: 3 },
] as const;

export const SAMPLE_COUNTS = [3, 5, 10, 20] as const;
