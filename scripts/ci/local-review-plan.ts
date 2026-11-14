import { affectedPackages } from "./ci-packages";
import { queueReviewPlan } from "./queue-review-plan";
import { priorityFromFile, testPriorities, testRunner } from "./test-discovery";
import { createTestPlan, mergeTestPlans, type SourceIdentity } from "./test-plan";
import { testPlanSetup } from "./test-plan-setup";
import { createTestRuns } from "./test-runs";

type Package = Parameters<typeof createTestRuns>[1][number];
interface Input {
  packages: Package[];
  tests: string[];
  changed: string[];
  additionalTests?: string[];
  source?: SourceIdentity;
}

const documentation = (file: string) =>
  /\.(md|mdx|txt)$/.test(file) || file.startsWith("design/") || file === "LICENSE";
const localRunners = new Set(["bun", "api", "cli", "browser-helper", "app"]);
const sharedInput = (file: string, packages: Package[]) =>
  !packages.some((pkg) => file.startsWith(`${pkg.dir}/`)) ||
  file.startsWith("scripts/build/") ||
  file === "scripts/test-setup.ts" ||
  file === "scripts/release/stage-package.ts" ||
  (file.startsWith("scripts/ci/") && !priorityFromFile(file));

const selectionReason = (explicit: boolean, edited: boolean, priority: string | undefined) => {
  if (explicit) return "explicit behavior coverage";
  if (edited) return "added or edited test";
  if (priority === "P0") return "affected P0";
  if (priority === "P1") return "affected P1 contract";
  return "affected extended coverage";
};
const deferredEvidence = (edited: boolean, priority: string | undefined) => {
  if (priority === "P3") return "nightly/release benchmarks; exceptional diagnostics only";
  if (edited) return "edited_tests";
  return "nightly/release coverage; exceptional diagnostics only";
};

const selectTests = (
  { packages, tests, changed, additionalTests = [] }: Input,
  shared: boolean,
  affectedOwners: string[],
  mandatory: Set<string>,
) => {
  const selected: { file: string; reason: string }[] = [];
  const deferred: { file: string; reason: string; evidence: string }[] = [];
  for (const file of tests) {
    const owner = packages.find((pkg) => file.startsWith(`${pkg.dir}/`));
    const affected = owner ? affectedOwners.includes(owner.name) : shared;
    const priority = priorityFromFile(file);
    const edited = changed.includes(file);
    const explicit = additionalTests.includes(file);
    if (!edited && !explicit && !affected && !mandatory.has(file)) continue;
    const runner = testRunner(file);
    const reason = mandatory.has(file) ? "merge queue minimum" : selectionReason(explicit, edited, priority);
    // Keep complete heavy workloads on isolated CI hosts; never shorten benchmarks.
    const remote =
      !mandatory.has(file) &&
      (priority === "P3" ||
        (!edited && !explicit && priority === "P2") ||
        !localRunners.has(runner) ||
        (runner === "app" && !edited && !explicit));
    if (remote) deferred.push({ file, reason, evidence: deferredEvidence(edited, priority) });
    else selected.push({ file, reason });
  }
  return { selected, deferred };
};

export const createLocalReviewPlan = ({ packages, tests, changed, additionalTests = [], source }: Input) => {
  for (const file of additionalTests) if (!tests.includes(file)) throw new Error(`Unknown test: ${file}`);
  const queue = queueReviewPlan(packages, tests, changed, source);
  const code = changed.filter((file) => !documentation(file));
  const shared = code.some((file) => sharedInput(file, packages));
  const affectedOwners = shared ? packages.map((pkg) => pkg.name) : affectedPackages(packages, code);
  const { selected, deferred } = selectTests(
    { packages, tests, changed, additionalTests },
    shared,
    affectedOwners,
    new Set([...queue.files, ...queue.smokeFiles]),
  );
  const runs = testPriorities.flatMap((priority) =>
    createTestRuns(
      selected.map((entry) => entry.file).filter((file) => !queue.smokeFiles.includes(file)),
      packages,
      priority,
    ),
  );
  const checkOwners = packages.filter((pkg) => queue.owners.includes(pkg.name) || affectedOwners.includes(pkg.name));
  const packageChecks = checkOwners.flatMap((pkg) => {
    const script = pkg.scripts.lint ? "lint" : "typecheck";
    return pkg.scripts[script] ? [{ id: `${pkg.name}:${script}`, cwd: pkg.dir, command: ["bun", "run", script] }] : [];
  });
  const setup = testPlanSetup(".", runs, packages);
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
  const buildCheck = setup.find((check) => check.id === "build-test-dependencies");
  for (const owner of queue.browserOwners)
    if (buildCheck && !buildCheck.command.includes(owner)) buildCheck.command.push("--scope", owner);
  // Nx accepts a concurrency limit; Electron Forge's package command does not.
  for (const check of setup.filter((check) => check.id.startsWith("build-"))) check.command.push("--concurrency", "1");
  const ui = packages.find((pkg) => pkg.name === "@pstdio/ui");
  // Generated declarations live in this install, outside Nx's portable build outputs.
  if (ui?.scripts["typegen:tokens"])
    setup.unshift({
      id: "generate-installed-theme-declarations",
      cwd: ui.dir,
      command: ["bun", "run", "typegen:tokens"],
    });
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
  const additionalPlan = createTestPlan({
    source: queue.testPlan.source,
    target: { platform: process.platform, arch: process.arch },
    packages,
    files: selected
      .map((entry) => entry.file)
      .filter((file) => !queue.files.includes(file) && !queue.smokeFiles.includes(file)),
    job: "local-additions",
  });
  return {
    testPlan: mergeTestPlans([queue.testPlan, additionalPlan], queue.testPlan.source),
    affectedOwners,
    changed,
    selected,
    deferred,
    setup,
    packageChecks,
    staticChecks,
    queueFiles: queue.files,
  };
};
