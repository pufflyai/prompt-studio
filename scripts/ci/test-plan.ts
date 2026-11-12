import { createHash } from "node:crypto";
import { suites } from "./benchmark-registry";
import type { TestPackage } from "./runner-profiles";
import { testPriorities } from "./test-discovery";
import { shardTestFiles } from "./test-file-shards";
import { fixtureExtensionsForRunner } from "./test-fixture-profiles";
import { testPlanSetup } from "./test-plan-setup";
import { matchesPlatform, quarantineRegistry, quarantineRunnerForTest } from "./test-quarantine";
import { createTestRuns } from "./test-runs";
import { compatibleTestTimings, type TestTimingSnapshot } from "./test-timing-snapshot";

export interface SourceIdentity {
  sha: string;
  tree: string;
  policy: string;
  dirty: boolean;
}
export interface Target {
  platform: string;
  arch: string;
}
export interface PlanInput {
  source: SourceIdentity;
  target: Target;
  packages: TestPackage[];
  files: string[];
  reason?: string;
  independentFiles?: boolean;
  includeQuarantine?: boolean;
  lane?: "stable" | "quarantine" | "ordered";
  job?: string;
  shard?: string;
  smoke?: boolean;
  windowsAllowance?: boolean;
  benchmarkSuite?: string;
  productionFamily?: string;
  candidateSourceSha?: string;
  artifact?: "source" | "compiled-cli" | "packaged-desktop" | "signed-candidate";
  timingSnapshot?: TestTimingSnapshot;
  coverage?: boolean;
}
export type PlannedRun = Omit<ReturnType<typeof createTestRuns>[number], "command"> & {
  target: Target;
  quarantineIds: string[];
  artifact: "source" | "compiled-cli" | "packaged-desktop" | "signed-candidate";
  requires: string[];
  reasons: string[];
  lane: "stable" | "quarantine" | "ordered";
  continueIndependentFiles: boolean;
  shard?: string;
  job?: string;
  smoke?: boolean;
  windowsAllowance?: boolean;
  benchmarkSuite?: string;
  productionFamily?: string;
  candidateSourceSha?: string;
};
export interface SetupStep {
  id: string;
  kind: "build" | "canvas" | "desktop" | "extension-fixtures";
  owners: string[];
  requires: string[];
}
export interface TestPlan {
  version: 1;
  digest: string;
  source: SourceIdentity;
  setup: SetupStep[];
  runs: PlannedRun[];
  emptyJobs?: string[];
  timingSnapshot?: TestTimingSnapshot;
}
const canonical = (value: unknown) =>
  JSON.stringify(value, (_key, entry) =>
    entry && typeof entry === "object" && !Array.isArray(entry)
      ? Object.fromEntries(
          Object.entries(entry)
            .filter(([, value]) => value !== undefined)
            .sort(([a], [b]) => a.localeCompare(b)),
        )
      : entry,
  );
export const planHash = (value: unknown) => createHash("sha256").update(canonical(value)).digest("hex");
export const sealTestPlan = (body: Omit<TestPlan, "digest">) => ({ ...body, digest: planHash(body) });

const runSetup = (run: Parameters<typeof testPlanSetup>[1][number], input: PlanInput) => {
  const steps: SetupStep[] = testPlanSetup(".", [run], input.packages).map((step) => {
    const kinds: Record<string, SetupStep["kind"]> = {
      "build-test-dependencies": "build",
      "build-canvas-previews": "canvas",
      "package-desktop": "desktop",
    };
    const kind = kinds[step.id]!;
    const owners =
      kind === "build"
        ? step.command.flatMap((arg, index) => (step.command[index - 1] === "--scope" ? [arg] : [])).sort()
        : [run.componentOwner ?? run.owner];
    return { id: `${kind}-${planHash(owners).slice(0, 16)}`, kind, owners, requires: [] } satisfies SetupStep;
  });
  const fixtureOwners = fixtureExtensionsForRunner(run.runner);
  if (fixtureOwners.length) {
    const owners = ["@pstdio/sdk", "@pstdio/ui"];
    const build = {
      id: `build-${planHash(owners).slice(0, 16)}`,
      kind: "build",
      owners,
      requires: [],
    } satisfies SetupStep;
    if (!steps.some((step) => step.id === build.id)) steps.push(build);
    steps.push({
      id: `extension-fixtures-${planHash({ owners: fixtureOwners, source: input.source, target: input.target, runner: run.runner, lane: input.lane ?? "stable", bun: Bun.version }).slice(0, 16)}`,
      kind: "extension-fixtures",
      owners: fixtureOwners,
      requires: [build.id],
    });
  }
  return steps;
};
const ordinaryTestPlan = (input: PlanInput) => {
  const selections = input.independentFiles ? [...new Set(input.files)].sort().map((file) => [file]) : [input.files];
  const groups = selections.flatMap((files) =>
    testPriorities.flatMap((priority) => createTestRuns(files, input.packages, priority)),
  );
  const shardGroups = groups
    .map((group) =>
      input.shard && !["app", "component", "desktop", "packaged-browser", "vite"].includes(group.runner)
        ? {
            ...group,
            files: shardTestFiles(group.files, {
              shard: input.shard,
              timings: compatibleTestTimings(input.timingSnapshot, {
                kind: "file",
                profile: `${group.owner}/${group.runner}`,
                host: `${input.target.platform}/${input.target.arch}`,
                configuration: `${input.artifact ?? "source"}:${input.lane ?? "stable"}:${group.priority}`,
                coverage: input.coverage ?? false,
              }),
            }).files,
          }
        : group,
    )
    .filter((group) => group.files.length);
  const setup = new Map<string, SetupStep>();
  const runs = shardGroups.map(({ command: _command, ...group }) => {
    const run = {
      ...group,
      runner:
        input.artifact === "compiled-cli" && group.files.every((file) => file.startsWith("packages/e2e/src/packaged/"))
          ? "packaged-cli"
          : group.runner,
    };
    const steps = runSetup(run, input);
    for (const step of steps) {
      if (["canvas", "desktop"].includes(step.kind))
        step.requires = steps.filter((item) => item.kind === "build").map((item) => item.id);
      setup.set(step.id, step);
    }
    const lane = input.lane ?? (run.priority === "P3" ? "ordered" : "stable");
    const artifact = runArtifact(input, run);
    const quarantineIds = quarantineRegistry
      .filter(
        (entry) =>
          run.files.includes(entry.file) &&
          entry.runner === quarantineRunnerForTest(run.runner) &&
          matchesPlatform(entry, input.target.platform, input.target.arch),
      )
      .map((entry) => `${entry.file}:${entry.name}`)
      .sort();
    const identity = {
      priority: run.priority,
      owner: run.owner,
      runner: run.runner,
      files: run.files,
      target: input.target,
      lane,
      artifact,
      quarantineIds,
      shard: input.shard,
      job: input.job,
      smoke: input.smoke,
    };
    return {
      ...run,
      id: planHash(identity).slice(0, 24),
      target: input.target,
      artifact,
      quarantineIds,
      requires: steps.map((step) => step.id),
      reasons: [input.reason ?? "explicit selection"],
      lane,
      continueIndependentFiles: input.independentFiles ?? false,
      job: input.job,
      shard: input.shard,
      smoke: input.smoke,
      windowsAllowance:
        input.windowsAllowance ||
        (lane === "quarantine" &&
          input.target.platform === "win32" &&
          run.runner === "bun" &&
          ["pstdio-db", "harness-codex", "harness-pi", "pstdio-planner", "@pstdio/desktop"].includes(run.owner)),
    } satisfies PlannedRun;
  });
  return sealTestPlan({
    version: 1,
    source: input.source,
    setup: [...setup.values()],
    runs,
    timingSnapshot: input.timingSnapshot,
  });
};
export const createTestPlan = (input: PlanInput) => {
  const benchmarkFiles = input.files.filter((file) => /\.p3\.(bench|perf)\.ts$/.test(file));
  const ordinary = ordinaryTestPlan({ ...input, files: input.files.filter((file) => !benchmarkFiles.includes(file)) });
  const plans = [ordinary];
  if (!input.lane && input.includeQuarantine !== false) {
    const files = [
      ...new Set(
        ordinary.runs
          .filter(
            (run) =>
              !input.shard ||
              input.shard.startsWith("1/") ||
              !["app", "component", "desktop", "packaged-browser", "vite"].includes(run.runner),
          )
          .flatMap((run) => run.files.filter((file) => run.quarantineIds.some((id) => id.startsWith(`${file}:`)))),
      ),
    ];
    if (files.length) plans.push(ordinaryTestPlan({ ...input, files, lane: "quarantine", shard: undefined }));
  }
  const benchmarkIds = [
    ...new Set(
      benchmarkFiles.map((file) => {
        const suite = suites.find((suite) => suite.files.includes(file));
        if (!suite) throw new Error(`Benchmark has no registered suite: ${file}`);
        return suite.id;
      }),
    ),
  ].sort();
  const benchmarks = benchmarkIds.map((id) => {
    const suite = suites.find((suite) => suite.id === id)!;
    const supported = suite.platforms;
    let target = input.target;
    if (supported && !supported.includes(`${target.platform}-${target.arch}`)) {
      const [platform, arch] = supported[0]!.split("-");
      target = { platform: platform!, arch: arch! };
    }
    return {
      id: planHash({ suite: id, target, job: input.job }).slice(0, 24),
      priority: "P3",
      owner: "benchmarks",
      cwd: ".",
      runner: "performance",
      componentOwner: undefined,
      files: suite.files,
      target,
      artifact: "source",
      requires: [],
      reasons: [input.reason ?? "complete registered benchmark suite"],
      lane: "ordered",
      quarantineIds: [],
      continueIndependentFiles: true,
      benchmarkSuite: id,
      job: input.job,
    } satisfies PlannedRun;
  });
  const merged = mergeTestPlans(plans, input.source);
  return sealTestPlan({
    version: 1,
    source: input.source,
    setup: merged.setup,
    runs: [...merged.runs, ...benchmarks],
    timingSnapshot: input.timingSnapshot,
  });
};
export const mergeTestPlans = (plans: TestPlan[], source: SourceIdentity) =>
  sealTestPlan({
    version: 1,
    source,
    setup: [...new Map(plans.flatMap((plan) => plan.setup).map((step) => [step.id, step])).values()],
    runs: plans.flatMap((plan) => plan.runs),
    timingSnapshot: plans.find((plan) => plan.timingSnapshot)?.timingSnapshot,
  });
export const validateTestPlan = (plan: TestPlan, source?: SourceIdentity) => {
  const { digest, ...body } = plan;
  if (plan.version !== 1 || digest !== planHash(body)) throw new Error("Invalid test plan digest or version");
  if (source && planHash(source) !== planHash(plan.source)) throw new Error("Test plan source does not match checkout");
  const ids = new Set<string>();
  const setup = new Map(plan.setup.map((step) => [step.id, step]));
  if (setup.size !== plan.setup.length) throw new Error("Duplicate setup ID");
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string) => {
    if (!setup.has(id)) throw new Error(`Unknown setup dependency: ${id}`);
    if (visiting.has(id)) throw new Error(`Cyclic setup dependency: ${id}`);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of setup.get(id)!.requires) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of setup.keys()) visit(id);
  for (const run of plan.runs) {
    if (ids.has(run.id)) throw new Error(`Duplicate run ID: ${run.id}`);
    ids.add(run.id);
    if (!run.files.length) throw new Error(`Empty run: ${run.id}`);
    for (const file of [...run.files, run.cwd])
      if (file.startsWith("/") || file.split("/").includes("..")) throw new Error(`Invalid planned path: ${file}`);
    for (const dependency of run.requires) visit(dependency);
  }
  return plan;
};

const runArtifact = (input: PlanInput, run: Parameters<typeof testPlanSetup>[1][number]) => {
  let artifact: PlannedRun["artifact"] = "source";
  if (run.runner.startsWith("packaged")) artifact = "compiled-cli";
  if (run.runner === "desktop" && run.files.some((file) => file.includes("/packaged-"))) artifact = "packaged-desktop";
  artifact = input.artifact ?? artifact;
  return artifact;
};
