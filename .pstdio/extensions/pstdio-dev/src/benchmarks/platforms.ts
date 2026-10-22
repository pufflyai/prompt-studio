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

export const SUITES = [
  { id: "desktop", label: "Desktop app" },
  { id: "workbench", label: "Workbench interactions" },
  { id: "chat", label: "Chat rendering" },
  { id: "subnav", label: "Side navigation" },
  { id: "planner", label: "Planner board" },
  { id: "storage", label: "Storage" },
  { id: "runtime", label: "Runtime" },
  { id: "relay", label: "Relay storage" },
] as const;

export const SAMPLE_COUNTS = [3, 5, 10, 20] as const;
