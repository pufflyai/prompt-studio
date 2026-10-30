export interface SuiteContext {
  /** Root of the checkout being measured. Every step runs against this commit's own code. */
  root: string;
  /** Kept between samples of one commit, for fixtures that are slow to build. */
  cacheDir: string;
  /** `${process.platform}-${process.arch}`, such as linux-x64. */
  platform: string;
  sha: string;
}

export interface SuiteStep {
  command: string[];
  /** Relative to the checkout root. */
  cwd?: string;
  env?: Record<string, string>;
  /** Limits a step to these platforms; other platforms skip it. */
  platforms?: string[];
}

export interface BenchmarkSuite {
  id: string;
  label: string;
  source: string;
  /** Runs once per commit before sampling, for builds and fixtures. */
  prepare?: (context: SuiteContext) => SuiteStep[];
  /** One sample. Every step reports its measurements through the writer. */
  sample: (context: SuiteContext) => SuiteStep[];
  platforms?: string[];
}

const LINUX = ["linux-x64"];
const isLinux = (context: SuiteContext) => context.platform.startsWith("linux-");
const arch = (context: SuiteContext) => context.platform.split("-")[1];
// Electron and Chromium need a display on Linux runners.
const display = (context: SuiteContext, command: string[]) =>
  isLinux(context) ? ["xvfb-run", "-a", ...command] : command;
const desktopOut = (context: SuiteContext) => `clients/desktop/out/prompt-studio-${context.platform}`;
const binaryName = (context: SuiteContext) => (context.platform.startsWith("win32-") ? "pstdio.exe" : "pstdio");
const packagedBinary = (context: SuiteContext) => ({
  E2E_PACKAGED_BINARY_PATH: `${context.root}/dist/${binaryName(context)}`,
});

// Chromium refuses to start on Linux unless its sandbox helper is owned by root and setuid.
const linuxSandbox = (path: string): SuiteStep[] => [
  { command: ["sudo", "chown", "root:root", path], platforms: LINUX },
  { command: ["sudo", "chmod", "4755", path], platforms: LINUX },
];

export const suites: BenchmarkSuite[] = [
  {
    id: "desktop",
    label: "Desktop app",
    source: "clients/desktop/src/e2e/packaged-*.bench.ts",
    prepare: (context) => [
      { command: ["bun", "run", "make", "--", `--arch=${arch(context)}`], cwd: "clients/desktop" },
      ...linuxSandbox(`${desktopOut(context)}/chrome-sandbox`),
    ],
    sample: (context) => [
      {
        command: display(context, ["bunx", "playwright", "test", "--config", "playwright.benchmark.config.ts"]),
        cwd: "clients/desktop",
        env: { PSTDIO_EXTENSION_RELEASE_REF: context.sha },
      },
    ],
  },
  {
    id: "workbench",
    label: "Workbench interactions",
    source: "packages/e2e/src/perf/*.perf.ts",
    prepare: () => [
      {
        command: [
          "bun",
          "run",
          "build",
          "--",
          "--scope",
          "e2e",
          "--scope",
          "pstdio-dashboard",
          "--include-dependencies",
        ],
      },
      { command: ["bunx", "playwright", "install", "chromium"], cwd: "packages/e2e" },
    ],
    sample: () => [
      {
        command: ["bun", "run", "src/scripts/run-playwright.ts", "-c", "playwright.perf.config.ts"],
        cwd: "packages/e2e",
      },
    ],
  },
  {
    id: "chat",
    label: "Chat rendering",
    source: "packages/ui/src/components/chat-ui/performance/*.perf.ts",
    prepare: () => [{ command: ["bunx", "playwright", "install", "chromium"], cwd: "packages/ui" }],
    sample: () => [
      {
        command: ["bunx", "playwright", "test", "--config", "playwright.chat-perf.config.ts"],
        cwd: "packages/ui",
      },
    ],
  },
  {
    id: "subnav",
    label: "Side navigation",
    source: "packages/e2e/src/perf/subnav.p3.bench.ts",
    prepare: () => [
      {
        command: [
          "bun",
          "run",
          "build",
          "--",
          "--scope",
          "pstdio-dashboard",
          "--scope",
          "pstdio-api",
          "--include-dependencies",
        ],
      },
      { command: ["bun", "run", "--cwd", "scripts", "build:host"] },
      { command: ["bunx", "playwright", "install", "chromium", "--no-shell"], cwd: "packages/e2e" },
    ],
    sample: (context) => [
      {
        command: ["bun", "src/perf/subnav.p3.bench.ts"],
        cwd: "packages/e2e",
        env: { ...packagedBinary(context), SUBNAV_SAMPLES: "5", SUBNAV_LABEL: context.sha },
      },
    ],
  },
  {
    id: "planner",
    label: "Planner board",
    source: "packages/e2e/src/perf/planner-board-cold-open.p3.bench.ts",
    prepare: () => [
      {
        command: [
          "bun",
          "run",
          "build",
          "--",
          "--scope",
          "pstdio-dashboard",
          "--scope",
          "pstdio-api",
          "--include-dependencies",
        ],
      },
      { command: ["bun", "run", "--cwd", "scripts", "build:host"] },
      { command: ["bunx", "playwright", "install", "chromium"], cwd: "packages/e2e" },
    ],
    sample: (context) => [
      {
        command: [
          "bun",
          "src/perf/planner-board-cold-open.p3.bench.ts",
          "--samples",
          "1",
          "--home",
          `${context.cacheDir}/planner-home`,
        ],
        cwd: "packages/e2e",
        env: packagedBinary(context),
      },
    ],
  },
  {
    id: "storage",
    label: "Storage",
    source: "packages/pstdio-db/src/services/**/*.bench.ts",
    sample: () => [
      { command: ["bun", "packages/pstdio-db/src/services/extension-storage/document-storage.p3.bench.ts"] },
      { command: ["bun", "--conditions=source", "packages/pstdio-db/src/services/sessions/session-query.p3.bench.ts"] },
    ],
  },
  {
    id: "runtime",
    label: "Runtime",
    source: "pstdio-api, pstdio-api-runtime-host, and pstdio-workbench *.bench.ts",
    // The workbench benchmark imports the SDK through its published entry points.
    prepare: () => [{ command: ["bun", "run", "build", "--", "--scope", "@pstdio/sdk", "--include-dependencies"] }],
    sample: (context) => [
      { command: ["bun", "run", "bench:session-resources"], cwd: "packages/pstdio-api-runtime-host" },
      { command: ["bun", "run", "bench:open-resources"], cwd: "packages/pstdio-workbench" },
      // The cleanup benchmark reads Linux cgroup and /proc counters for its CPU and memory figures.
      {
        command: [
          "bun",
          "--conditions=source",
          "packages/pstdio-api/src/features/workspaces/worktree-cleanup.p3.bench.ts",
        ],
        // Two workers matches the host's deletion queue.
        env: { BENCH_ROOT: `${context.cacheDir}/worktree-cleanup`, BENCH_REPEATS: "1", BENCH_LIMITS: "2" },
        platforms: LINUX,
      },
    ],
  },
  {
    id: "relay",
    label: "Relay storage",
    source: "services/relay/scripts/storage-bound.p3.bench.ts",
    // Needs Docker for Postgres and object storage, which only the Linux runners provide.
    platforms: LINUX,
    sample: () => [{ command: ["bun", "run", "bench:storage-bound"], cwd: "services/relay" }],
  },
];

export const suiteIds = suites.map((suite) => suite.id);

export const runsOn = (platforms: string[] | undefined, platform: string) => !platforms || platforms.includes(platform);
