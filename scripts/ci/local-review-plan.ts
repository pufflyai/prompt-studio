import { affectedPackages } from "./ci-packages";
import { createPriorityPlan } from "./priority-plan";
import { priorityPlanSetup } from "./priority-plan-setup";
import { priorityFromFile, testPriorities, testRunner } from "./test-discovery";

type Package = Parameters<typeof createPriorityPlan>[1][number];
interface Input {
  packages: Package[];
  tests: string[];
  changed: string[];
  additionalTests?: string[];
}

const documentation = (file: string) =>
  /\.(md|mdx|txt)$/.test(file) || file.startsWith("design/") || file === "LICENSE";
const localRunners = new Set(["bun", "api", "cli", "browser-helper", "app"]);
const startupSmoke = "packages/e2e/src/ui/startup.p1.spec.ts";
const appComposition = (file: string) =>
  /^packages\/(pstdio|pstdio-api|pstdio-dashboard|pstdio-extensions|pstdio-workbench)\//.test(file);
const sharedInput = (file: string, packages: Package[]) =>
  !packages.some((pkg) => file.startsWith(`${pkg.dir}/`)) ||
  file.startsWith("scripts/build/") ||
  file === "scripts/test-setup.ts" ||
  file === "scripts/release/stage-package.ts" ||
  (file.startsWith("scripts/ci/") && !priorityFromFile(file));

const selectionReason = (explicit: boolean, edited: boolean, smoke: boolean, priority: string | undefined) => {
  if (explicit) return "explicit behavior coverage";
  if (edited) return "added or edited test";
  if (smoke) return "app composition";
  if (priority === "P0") return "affected P0";
  if (priority === "P1") return "affected P1 contract";
  return "affected extended coverage";
};
const deferredEvidence = (edited: boolean, priority: string | undefined) => {
  if (edited) return "edited_tests";
  if (priority === "P3") return "complete benchmark diagnostics required";
  return "ci:full diagnostics required";
};

const selectTests = (
  { packages, tests, changed, additionalTests = [] }: Input,
  code: string[],
  shared: boolean,
  affectedOwners: string[],
) => {
  const selected: { file: string; reason: string }[] = [];
  const deferred: { file: string; reason: string; evidence: string }[] = [];
  for (const file of tests) {
    const owner = packages.find((pkg) => file.startsWith(`${pkg.dir}/`));
    const affected = owner ? affectedOwners.includes(owner.name) : shared;
    const priority = priorityFromFile(file);
    const edited = changed.includes(file);
    const explicit = additionalTests.includes(file);
    const smoke = file === startupSmoke && code.some(appComposition);
    if (!edited && !explicit && !smoke && !affected) continue;
    const runner = testRunner(file);
    const reason = selectionReason(explicit, edited, smoke, priority);
    // Keep complete heavy workloads on isolated CI hosts; never shorten benchmarks.
    const remote =
      priority === "P3" ||
      (!edited && !explicit && priority === "P2") ||
      !localRunners.has(runner) ||
      (runner === "app" && !edited && !explicit && !smoke);
    if (remote) deferred.push({ file, reason, evidence: deferredEvidence(edited, priority) });
    else selected.push({ file, reason });
  }
  return { selected, deferred };
};

export const createLocalReviewPlan = ({ packages, tests, changed, additionalTests = [] }: Input) => {
  for (const file of additionalTests) if (!tests.includes(file)) throw new Error(`Unknown test: ${file}`);
  const code = changed.filter((file) => !documentation(file));
  const shared = code.some((file) => sharedInput(file, packages));
  const affectedOwners = shared ? packages.map((pkg) => pkg.name) : affectedPackages(packages, code);
  const { selected, deferred } = selectTests(
    { packages, tests, changed, additionalTests },
    code,
    shared,
    affectedOwners,
  );
  const runs = testPriorities.flatMap((priority) =>
    createPriorityPlan(
      selected.map((entry) => entry.file),
      packages,
      priority,
    ),
  );
  const checkOwners = packages.filter((pkg) => affectedOwners.includes(pkg.name));
  const packageChecks = checkOwners.flatMap((pkg) => {
    const script = pkg.scripts.lint ? "lint" : "typecheck";
    return pkg.scripts[script] ? [{ id: `${pkg.name}:${script}`, cwd: pkg.dir, command: ["bun", "run", script] }] : [];
  });
  const setup = priorityPlanSetup(".", runs, packages);
  const build = setup.find((check) => check.id === "build-test-dependencies");
  // Types can consume declarations even when a package has no selected tests.
  if (!build && checkOwners.length) {
    setup.unshift({
      id: "build-test-dependencies",
      cwd: ".",
      command: [
        "bun",
        "run",
        "build",
        "--",
        ...checkOwners.flatMap((pkg) => ["--scope", pkg.name]),
        "--include-dependencies",
      ],
    });
  } else if (build) {
    for (const pkg of checkOwners) if (!build.command.includes(pkg.name)) build.command.push("--scope", pkg.name);
  }
  for (const check of setup) check.command.push("--concurrency", "1");
  const staticChecks = [
    {
      id: "docs-links",
      cwd: ".",
      command: ["bun", "run", "--cwd", "scripts", "verify:docs-links"],
    },
  ];
  if (code.length)
    staticChecks.push(
      { id: "boundaries", cwd: ".", command: ["bun", "run", "verify:boundaries"] },
      {
        id: "format",
        cwd: ".",
        command: ["bun", "x", "--no-install", "biome", "check", "--no-errors-on-unmatched", ...code],
      },
    );
  if (code.some((file) => /^packages\/(sdk|ui|pstdio-api-contracts)\//.test(file)))
    staticChecks.push(
      { id: "sdk-reference", cwd: ".", command: ["bun", "run", "--cwd", "scripts", "verify:sdk-reference"] },
      { id: "extension-api-version", cwd: ".", command: ["bun", "run", "verify:extension-api-version"] },
    );
  return { affectedOwners, changed, selected, deferred, runs, setup, packageChecks, staticChecks };
};
