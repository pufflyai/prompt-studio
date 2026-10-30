import { dirname, relative } from "node:path";
import { suites } from "pstdio-benchmarks";
import { selectPriorityTests, testRunner } from "./test-discovery";
import type { TestPriority } from "./test-policy";

interface TestPackage {
  name: string;
  dir: string;
  dependencies: string[];
  scripts: Record<string, string>;
}
interface Selection {
  scope?: string;
  runner?: string;
}
interface TestGroup {
  owner: TestPackage;
  runner: string;
  files: string[];
  storybook?: string;
}

const workbenchBenchmarks = new Set(suites.find((suite) => suite.id === "workbench")!.files);

const performanceCommand = (paths: string[], owner: TestPackage) => {
  if (owner.name === "@pstdio/desktop") return ["bun", "run", "test:benchmark", ...paths];
  if (owner.name === "@pstdio/ui") return ["bun", "run", "perf:chat", ...paths];
  if (paths.every((path) => path.startsWith("src/packaged/")))
    return ["bun", "run", "test:packaged:benchmark", ...paths];
  if (paths.every((path) => workbenchBenchmarks.has(`${owner.dir}/${path}`)))
    return ["bun", "run", "perf:frontend", ...paths];
  const configured = Object.entries(owner.scripts).find(
    ([name, command]) => name.startsWith("bench:") && paths.length === 1 && command.includes(paths[0]!),
  );
  if (configured) return ["bun", "run", configured[0]];
  return ["bun", ...paths];
};

const runCommand = (runner: string, files: string[], owner: TestPackage, storybook?: string) => {
  const paths = files.map((file) => relative(owner.dir, file).replaceAll("\\", "/"));
  if (runner === "api") return ["bun", "run", "test", `--files=${JSON.stringify(paths)}`];
  const script = {
    component: "test:browser",
    app: "test:ui",
    vite: "test:vite-terminal",
    "packaged-cli": "test:packaged:cli",
    "packaged-browser": "test:packaged:browser",
  }[runner];
  if (script) return ["bun", "run", script, ...paths];
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
  if (runner === "performance") return performanceCommand(paths, owner);
  if (storybook) throw new Error("A Storybook owner requires the component runner");
  if (
    owner.scripts.test &&
    owner.scripts.test.trim() !== "bun test" &&
    owner.name !== "e2e" &&
    owner.name !== "storybook-tests" &&
    runner !== "browser-helper"
  )
    return ["bun", "run", "test", ...paths.map((path) => `./${path}`)];
  const wrapper = relative(owner.dir, "scripts/ci/run-bun-tests.ts").replaceAll("\\", "/");
  const preload =
    owner.name === "e2e" ? ["--preload", "./src/scripts/bun-process-cleanup.ts", "--timeout", "30000"] : [];
  return ["bun", wrapper, ...preload, ...paths.map((path) => `./${path}`)];
};

const groupDetails = (file: string, runner: string, owner: TestPackage) => {
  if (runner === "component") {
    const storybook = relative("packages/storybook-tests/src/ui", dirname(file)).replaceAll("\\", "/");
    if (!storybook || storybook.includes("/")) throw new Error(`Component test needs an owner directory: ${file}`);
    return { subgroup: storybook, storybook };
  }
  if (runner === "desktop") return { subgroup: file.includes("/packaged-") ? "packaged" : "source" };
  if (runner !== "performance") return { subgroup: "" };
  if (
    owner.name === "@pstdio/desktop" ||
    owner.name === "@pstdio/ui" ||
    (workbenchBenchmarks.has(file) && file.startsWith("packages/e2e/src/perf/"))
  )
    return { subgroup: "browser" };
  if (file.startsWith("packages/e2e/src/packaged/")) return { subgroup: "packaged-browser" };
  return { subgroup: file };
};

const groupRuns = (id: string, group: TestGroup, priority: TestPriority) => {
  const base = {
    id,
    priority,
    owner: group.owner.name,
    cwd: group.owner.dir,
    runner: group.runner,
    files: group.files,
    storybook: group.storybook,
  };
  if (group.runner !== "integration")
    return [{ ...base, command: runCommand(group.runner, group.files, group.owner, group.storybook) }];
  if (group.owner.scripts["test:integration"])
    return [
      {
        ...base,
        command: [
          "bun",
          "run",
          "test:integration",
          ...group.files.map((file) => relative(group.owner.dir, file).replaceAll("\\", "/")),
        ],
      },
    ];
  return group.files.map((file) => ({
    ...base,
    id: `${id}:${file}`,
    files: [file],
    command: ["bun", relative(group.owner.dir, file).replaceAll("\\", "/")],
  }));
};

export const createPriorityPlan = (
  files: string[],
  packages: TestPackage[],
  priority: TestPriority,
  options: Selection = {},
) => {
  const groups = new Map<string, TestGroup>();
  for (const file of selectPriorityTests(files, [priority])) {
    const owner = packages.find((pkg) => file.startsWith(`${pkg.dir}/`)) ?? {
      name: "repository",
      dir: ".",
      dependencies: [],
      scripts: {},
    };
    const runner = testRunner(file);
    const { subgroup, storybook } = groupDetails(file, runner, owner);
    const sourceOwner = storybook ? packages.find((pkg) => pkg.dir === `packages/${storybook}`) : undefined;
    const scopedOwners = sourceOwner ? [owner, sourceOwner] : [owner];
    if (
      options.scope &&
      !options.scope.split(",").some((scope) => scopedOwners.some((pkg) => pkg.name === scope || pkg.dir === scope))
    )
      continue;
    if (options.runner && runner !== options.runner) continue;
    const id = `${owner.name}:${runner}${subgroup ? `:${subgroup}` : ""}`;
    const group = groups.get(id) ?? { owner, runner, files: [], ...(storybook ? { storybook } : {}) };
    group.files.push(file);
    groups.set(id, group);
  }
  return [...groups].sort(([a], [b]) => a.localeCompare(b)).flatMap(([id, group]) => groupRuns(id, group, priority));
};
