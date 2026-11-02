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

export interface SuiteOption {
  id: string;
  label: string;
  minutes: number;
  // Platforms the suite is limited to, and why. Other suites run everywhere.
  platforms?: string[];
  reason?: string;
}

// Mirrors the suite list in packages/benchmarks, which this extension cannot import. Minutes are rough
// costs of one execution on a Linux runner, used only to estimate a run's length.
export const SUITES: SuiteOption[] = [
  { id: "desktop", label: "Desktop app", minutes: 3 },
  { id: "workbench", label: "Workbench interactions", minutes: 4 },
  { id: "canvas", label: "Canvas cold startup", minutes: 2 },
  { id: "chat", label: "Chat rendering", minutes: 3 },
  { id: "subnav", label: "Side navigation", minutes: 2 },
  { id: "planner", label: "Planner board", minutes: 1 },
  { id: "storage", label: "Storage", minutes: 1 },
  { id: "runtime", label: "Runtime", minutes: 1 },
  { id: "relay", label: "Relay storage", minutes: 3, platforms: ["linux-x64"], reason: "Needs Linux x64 and Docker" },
];

// The relay suite needs Docker and minutes of setup, so runs leave it out unless chosen.
export const DEFAULT_SUITES = SUITES.filter((suite) => suite.id !== "relay").map((suite) => suite.id);

// CI plans one job per suite and platform the suite supports; the form and commands use the same rule.
export const runsOn = (suite: SuiteOption, platform: string) => !suite.platforms || suite.platforms.includes(platform);

// Mirrors timeout-minutes of the benchmark job in .github/workflows/benchmarks.yml.
export const JOB_LIMIT_MINUTES = 45;
