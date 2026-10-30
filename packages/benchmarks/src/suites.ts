import type { BenchmarkSuite, SuiteContext, SuiteStep } from "./suite-types";

export type { BenchmarkSuite, SuiteContext, SuiteStep } from "./suite-types";

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
    files: [
      "clients/desktop/src/e2e/packaged-launch.p3.bench.ts",
      "clients/desktop/src/e2e/packaged-renderer.p3.bench.ts",
    ],
    prepare: (context) => [
      { command: ["bun", "run", "make", "--", `--arch=${arch(context)}`], cwd: "clients/desktop" },
      ...linuxSandbox(`${desktopOut(context)}/chrome-sandbox`),
    ],
    sample: (context, files) => [
      {
        command: display(context, [
          "bun",
          "run",
          "test:benchmark",
          ...files.map((file) => file.replace("clients/desktop/", "")),
        ]),
        cwd: "clients/desktop",
        env: { PSTDIO_EXTENSION_RELEASE_REF: context.sha },
      },
    ],
  },
  {
    id: "workbench",
    label: "Workbench interactions",
    files: [
      "packages/e2e/src/perf/nav-chrome.p3.bench.ts",
      "packages/e2e/src/perf/panel-tabs.p3.bench.ts",
      "packages/e2e/src/perf/project-switch.p3.bench.ts",
      "packages/e2e/src/perf/resource-hierarchy.p3.bench.ts",
      "packages/e2e/src/perf/side-panel.p3.bench.ts",
      "packages/e2e/src/perf/sidenav-header.p3.bench.ts",
      "packages/e2e/src/perf/workbench-interactions.p3.bench.ts",
      "packages/e2e/src/packaged/packaged-paged-collections.p3.bench.ts",
    ],
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
      { command: ["bun", "run", "--cwd", "scripts", "build:host"] },
      { command: ["bunx", "playwright", "install", "chromium"], cwd: "packages/e2e" },
    ],
    sample: (context, files) => [
      {
        command: [
          "bun",
          "run",
          "src/scripts/run-playwright.ts",
          "-c",
          "playwright.perf.config.ts",
          ...files.filter((file) => file.includes("/perf/")).map((file) => file.replace("packages/e2e/", "")),
        ],
        cwd: "packages/e2e",
        env: packagedBinary(context),
      },
      {
        command: [
          "bun",
          "run",
          "test:packaged:benchmark",
          ...files.filter((file) => file.includes("/packaged/")).map((file) => file.replace("packages/e2e/", "")),
        ],
        cwd: "packages/e2e",
        env: packagedBinary(context),
      },
    ],
  },
  {
    id: "canvas",
    label: "Canvas cold startup",
    files: ["packages/canvas-tests/src/performance/frame-startup.p3.bench.ts"],
    prepare: () => [
      { command: ["bun", "x", "--no-install", "lerna", "run", "build:previews", "--scope", "canvas-tests"] },
      { command: ["bunx", "playwright", "install", "chromium"], cwd: "packages/canvas-tests" },
    ],
    sample: (_context, files) => [
      {
        command: [
          "bun",
          "run",
          "test:browser",
          "--config",
          "playwright.startup-perf.config.ts",
          ...files.map((file) => file.replace("packages/canvas-tests/", "")),
        ],
        cwd: "packages/canvas-tests",
      },
    ],
  },
  {
    id: "chat",
    label: "Chat rendering",
    files: [
      "packages/ui/src/components/chat-ui/performance/chat-panel.p3.bench.ts",
      "packages/ui/src/components/chat-ui/performance/chat-rendering.p3.bench.ts",
    ],
    prepare: () => [{ command: ["bunx", "playwright", "install", "chromium"], cwd: "packages/ui" }],
    sample: (_context, files) => [
      {
        command: [
          "bunx",
          "playwright",
          "test",
          "--config",
          "playwright.chat-perf.config.ts",
          ...files.map((file) => file.replace("packages/ui/", "")),
        ],
        cwd: "packages/ui",
      },
    ],
  },
  {
    id: "subnav",
    label: "Side navigation",
    files: ["packages/e2e/src/perf/subnav.p3.bench.ts"],
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
    sample: (context, files) =>
      files.map((file) => ({
        command: ["bun", file.replace("packages/e2e/", "")],
        cwd: "packages/e2e",
        env: { ...packagedBinary(context), SUBNAV_LABEL: context.sha },
      })),
  },
  {
    id: "planner",
    label: "Planner board",
    files: ["packages/e2e/src/perf/planner-board-cold-open.p3.bench.ts"],
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
    sample: (context, files) =>
      files.map((file) => ({
        command: [
          "bun",
          file.replace("packages/e2e/", ""),
          "--home",
          `${context.cacheDir}/${file.split("/").at(-1)}-home`,
        ],
        cwd: "packages/e2e",
        env: packagedBinary(context),
      })),
  },
  {
    id: "storage",
    label: "Storage",
    files: [
      "packages/pstdio-db/src/services/extension-storage/document-storage.p3.bench.ts",
      "packages/pstdio-db/src/services/sessions/session-query.p3.bench.ts",
    ],
    sample: (_context, files) =>
      files.map((file) => ({
        command: ["bun", ...(file.includes("session-query") ? ["--conditions=source"] : []), file],
      })),
  },
  {
    id: "runtime",
    label: "Runtime",
    files: [
      "packages/pstdio-api-runtime-host/src/harness-session-resources.p3.bench.ts",
      "packages/pstdio-workbench/src/core/controllers/page-runtime/open-resource-inventory.p3.bench.ts",
      "packages/pstdio-api/src/features/workspaces/worktree-cleanup.p3.bench.ts",
    ],
    // The workbench benchmark imports the SDK through its published entry points.
    prepare: () => [{ command: ["bun", "run", "build", "--", "--scope", "@pstdio/sdk", "--include-dependencies"] }],
    sample: (context, files) =>
      files.map((file) =>
        file.includes("worktree-cleanup")
          ? {
              command: ["bun", "--conditions=source", file],
              env: { BENCH_ROOT: `${context.cacheDir}/worktree-cleanup`, BENCH_LIMITS: "2" },
              platforms: LINUX,
            }
          : { command: ["bun", file] },
      ),
  },
  {
    id: "relay",
    label: "Relay storage",
    files: ["services/relay/scripts/storage-bound.p3.bench.ts"],
    // Needs Docker for Postgres and object storage, which only the Linux runners provide.
    platforms: LINUX,
    sample: (_context, files) => files.map((file) => ({ command: ["bun", file] })),
  },
];

export const suiteIds = suites.map((suite) => suite.id);

export const runsOn = (platforms: string[] | undefined, platform: string) => !platforms || platforms.includes(platform);
