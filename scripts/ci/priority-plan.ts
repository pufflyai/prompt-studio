import { dirname, relative } from "node:path";
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
  componentOwner?: string;
}

const performanceCommand = (paths: string[], owner: TestPackage) => {
  if (owner.name === "@pstdio/desktop") return ["bun", "run", "test:benchmark", ...paths];
  if (owner.name === "@pstdio/ui") return ["bun", "run", "perf:chat", ...paths];
  if (paths.every((path) => path.startsWith("src/packaged/")))
    return ["bun", "run", "test:packaged:benchmark", ...paths];
  if (paths.every((path) => path.endsWith(".perf.ts"))) return ["bun", "run", "perf:frontend", ...paths];
  const configured = Object.entries(owner.scripts).find(
    ([name, command]) => name.startsWith("bench:") && paths.length === 1 && command.includes(paths[0]!),
  );
  if (configured) return ["bun", "run", configured[0]];
  return ["bun", ...paths];
};

const runCommand = (runner: string, files: string[], owner: TestPackage, componentOwner?: string) => {
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
  if (componentOwner) throw new Error("A Canvas preview owner requires the component runner");
  if (
    owner.scripts.test &&
    owner.scripts.test.trim() !== "bun test" &&
    owner.name !== "e2e" &&
    owner.name !== "canvas-tests" &&
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
    const componentOwner = relative("packages/canvas-tests/src/ui", dirname(file)).replaceAll("\\", "/");
    if (!componentOwner || componentOwner.includes("/"))
      throw new Error(`Component test needs an owner directory: ${file}`);
    return { subgroup: componentOwner, componentOwner };
  }
  if (runner === "desktop") return { subgroup: file.includes("/packaged-") ? "packaged" : "source" };
  if (runner !== "performance") return { subgroup: "" };
  if (owner.name === "@pstdio/desktop" || owner.name === "@pstdio/ui" || file.endsWith(".perf.ts"))
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
    componentOwner: group.componentOwner,
  };
  if (group.runner !== "integration")
    return [{ ...base, command: runCommand(group.runner, group.files, group.owner, group.componentOwner) }];
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
    const { subgroup, componentOwner } = groupDetails(file, runner, owner);
    const sourceOwner = componentOwner ? packages.find((pkg) => pkg.dir === `packages/${componentOwner}`) : undefined;
    const scopedOwners = sourceOwner ? [owner, sourceOwner] : [owner];
    if (
      options.scope &&
      !options.scope.split(",").some((scope) => scopedOwners.some((pkg) => pkg.name === scope || pkg.dir === scope))
    )
      continue;
    if (options.runner && runner !== options.runner) continue;
    const id = `${owner.name}:${runner}${subgroup ? `:${subgroup}` : ""}`;
    const group = groups.get(id) ?? { owner, runner, files: [], ...(componentOwner ? { componentOwner } : {}) };
    group.files.push(file);
    groups.set(id, group);
  }
  return [...groups].sort(([a], [b]) => a.localeCompare(b)).flatMap(([id, group]) => groupRuns(id, group, priority));
};
