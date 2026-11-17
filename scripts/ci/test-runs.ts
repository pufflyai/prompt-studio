import { dirname, relative } from "node:path";
import { canvasTestOwner } from "./canvas-test-owner";
import { runnerCommand, type TestPackage } from "./runner-profiles";
import { selectPriorityTests, testRunner } from "./test-discovery";
import type { TestPriority } from "./test-policy";

interface Selection {
  scope?: string;
  runner?: string;
  // Every case may be quarantined on this platform; the quarantine lane must still execute them.
  allowQuarantineOnly?: boolean;
}

const playwrightRunners = new Set(["app", "desktop", "packaged-browser"]);
interface TestGroup {
  owner: TestPackage;
  runner: string;
  files: string[];
  componentOwner?: string;
}

const groupDetails = (file: string, runner: string) => {
  if (runner === "component") {
    const componentOwner = relative("packages/canvas-tests/src/ui", dirname(file)).replaceAll("\\", "/");
    if (!componentOwner || componentOwner.includes("/"))
      throw new Error(`Component test needs an owner directory: ${file}`);
    return { subgroup: componentOwner, componentOwner };
  }
  if (runner === "desktop") return { subgroup: file.includes("/packaged-") ? "packaged" : "source" };
  if (runner !== "performance") return { subgroup: "" };
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
    return [{ ...base, command: runnerCommand(group.runner, group.files, group.owner, group.componentOwner) }];
  if (["pstdio-account-manager", "pstdio-relay", "pstdio-psx"].includes(group.owner.name))
    return [{ ...base, command: runnerCommand(group.runner, group.files, group.owner) }];
  return group.files.map((file) => ({
    ...base,
    id: `${id}:${file}`,
    files: [file],
    command: ["bun", relative(group.owner.dir, file).replaceAll("\\", "/")],
  }));
};

export const createTestRuns = (
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
    const { subgroup, componentOwner } = groupDetails(file, runner);
    const sourceOwner = componentOwner ? canvasTestOwner(packages, componentOwner) : undefined;
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
  return [...groups]
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([id, group]) => groupRuns(id, group, priority))
    .map((run) =>
      options.allowQuarantineOnly && playwrightRunners.has(run.runner)
        ? { ...run, command: [...run.command, "--pass-with-no-tests"] }
        : run,
    );
};
