import { relative } from "node:path";

export interface TestPackage {
  name: string;
  dir: string;
  dependencies: string[];
  scripts: Record<string, string>;
}
// Source-only overrides: package scripts never decide how a planned run executes.
const bunFlags = (owner: string) => {
  const flags = ["--silent"];
  if (["pstdio-dashboard", "@pstdio/ui", "@pstdio/workbench", "pstdio-extension-testbench", "pstdio"].includes(owner))
    flags.push("--conditions", "production");
  if (owner === "pstdio-extensions") flags.push("--conditions", "source");
  if (owner === "pstdio-dashboard") flags.push("--tsconfig-override", "tsconfig.app.json");
  if (owner === "pstdio-wt") flags.push("--timeout", "30000");
  return flags;
};

export const runnerCommand = (runner: string, files: string[], owner: TestPackage, componentOwner?: string) => {
  const paths = files.map((file) => relative(owner.dir, file).replaceAll("\\", "/"));
  if (runner === "integration") {
    if (["pstdio-account-manager", "pstdio-relay", "pstdio-psx"].includes(owner.name))
      return [
        "bun",
        relative(owner.dir, "scripts/ci/run-service-integrations.ts").replaceAll("\\", "/"),
        owner.name,
        ...paths,
      ];
    if (paths.length !== 1) throw new Error("Standalone integrations run independently");
    return ["bun", ...paths];
  }
  if (runner === "api")
    return [
      "bun",
      "x",
      "--no-install",
      "cross-env",
      "PSTDIO_DEFAULT_EXTENSIONS=[]",
      "PSTDIO_EXTENSION_WEBVIEW_BUILDS=0",
      "bun",
      "src/test-utils/run-api-tests.ts",
      `--files=${JSON.stringify(paths)}`,
    ];
  const entry = {
    component: ["bun", "src/scripts/run-browser.ts"],
    app: ["bun", "src/scripts/run-playwright.ts"],
    vite: ["bun", "src/scripts/run-vite-terminal-playwright.ts"],
    "packaged-cli": ["bun", "src/packaged/run-packaged-cli-tests.ts"],
    "packaged-browser": ["bun", "x", "--no-install", "playwright", "test", "--config", "playwright.packaged.config.ts"],
  }[runner];
  if (entry) return [...entry, ...paths];
  if (runner === "cli")
    return [
      "bun",
      "../../scripts/ci/run-bun-tests.ts",
      "--preload",
      "./src/scripts/bun-process-cleanup.ts",
      "--timeout",
      "30000",
      ...paths.map((path) => `./${path}`),
    ];
  if (runner === "desktop") {
    const packaged = paths.every((file) => file.includes("/packaged-"));
    return [
      "bun",
      "x",
      "--no-install",
      "playwright",
      "test",
      "--config",
      packaged ? "playwright.packaged.config.ts" : "playwright.config.ts",
      ...paths,
    ];
  }
  if (runner === "performance") return [];
  if (componentOwner) throw new Error("A Canvas preview owner requires the component runner");
  const wrapper = relative(owner.dir, "scripts/ci/run-bun-tests.ts").replaceAll("\\", "/");
  const preload =
    owner.name === "e2e" ? ["--preload", "./src/scripts/bun-process-cleanup.ts", "--timeout", "30000"] : [];
  return ["bun", wrapper, ...bunFlags(owner.name), ...preload, ...paths.map((path) => `./${path}`)];
};
