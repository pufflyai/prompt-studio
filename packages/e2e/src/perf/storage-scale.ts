import { execFileSync } from "node:child_process";
import { appendFileSync, closeSync, existsSync, mkdirSync, openSync } from "node:fs";
import { arch, cpus, freemem, platform, release, totalmem } from "node:os";
import { join, resolve } from "node:path";
import { contract, type Profile, runBenchmarkCase, type Workload } from "storage-scale-fixture";
import { PACKAGED_BINARY_PATH } from "../packaged/packaged-helpers";
import { configuredContainer } from "./storage-scale-container";
import { sampleScaleRuntime } from "./storage-scale-samples";
import { enterMeasurementWindow } from "./storage-scale-window";

const option = (flag: string, fallback?: string) => {
  const at = process.argv.indexOf(flag);
  if (at === -1) return fallback;
  if (!process.argv[at + 1] || process.argv[at + 1].startsWith("--")) throw new Error(`Missing ${flag} value`);
  return process.argv[at + 1];
};

const runLayer = async (kind: Workload, root: string, layer: string, emit: (data: object) => void) => {
  if (!["sync", "database"].includes(layer)) throw new Error("Unknown layer");
  const count = Number(option("--rows"));
  if (!contract.scaling[kind].includes(count)) throw new Error("Choose a frozen scaling workload");
  const repo = resolve(import.meta.dirname, "../../../..");
  const script =
    layer === "sync"
      ? "packages/pstdio-sync/src/relay/document-scale.bench.ts"
      : "packages/pstdio-db/src/services/extension-storage/document-scale.bench.ts";
  const phases =
    layer === "sync"
      ? ["owner"]
      : ["seed", ...(process.argv.includes("--churn") ? ["churn"] : []), ...Array(10).fill("sample")];
  for (const phase of phases) {
    const args = [script, kind, String(count)];
    const snapshot = join(root, "database-work");
    const sampleRoot = join(root, "database-sample");
    if (layer === "database") {
      args.push(phase === "sample" ? sampleRoot : snapshot, phase);
      if (phase === "sample") args.push(snapshot);
    } else if (process.argv.includes("--churn")) args.push("churn");
    const stdout = openSync(join(root, `${layer}.jsonl`), "a");
    const stderr = openSync(join(root, `${layer}.stderr.log`), "a");
    try {
      const run = await runBenchmarkCase({
        name: `${layer}-${kind}-${count}-${phase}`,
        command: process.execPath,
        args,
        cwd: repo,
        stdout,
        stderr,
        emit,
      });
      if (!run.complete) throw new Error(`Layer case ${run.status}; partial output retained in ${layer}.jsonl`);
    } finally {
      closeSync(stdout);
      closeSync(stderr);
    }
  }
};

const runPreparation = async (
  preparation: string,
  root: string,
  home: string | undefined,
  kind: Workload,
  emit: (data: object) => void,
) => {
  const stdout = openSync(join(root, "preparation.jsonl"), "a");
  const stderr = openSync(join(root, "preparation.stderr.log"), "a");
  try {
    const run = await runBenchmarkCase({
      name: preparation,
      command: process.execPath,
      args: [
        join(import.meta.dirname, "storage-scale-prepare.ts"),
        preparation,
        join(root, "fixture"),
        home ? resolve(home) : "",
        kind,
        String(process.argv.includes("--churn")),
      ],
      stdout,
      stderr,
      containerFilters: home
        ? [configuredContainer(home)?.containerId].filter((id) => id !== undefined).map((id) => `id=${id}`)
        : [],
      emit,
    });
    if (!run.complete)
      throw new Error(`Preparation ${run.status}; partial fixture is invalid and retained for diagnosis`);
  } finally {
    closeSync(stdout);
    closeSync(stderr);
  }
};

export const runScaleDiagnostic = async () => {
  if (process.argv.includes("--help")) {
    console.log(`Diagnostic storage scale baseline (not a required release check).
  --fixture rich|small --output <directory> --emit-fixture
  --fixture rich|small --output <directory> --home <disposable-directory> --seed [--churn]
  --fixture rich|small --output <directory> --home <seeded-directory> --measure --profile native|renderer
  Add --container-config <runtime.json> for isolated native|renderer|runtime|combined profiles.
  --operation <name> --background <name> select complete ten-cold/ten-warm shards; --sync prepares a relay.
  --fixture rich|small --output <directory> --layer sync|database --rows 1000|10000|100000
  Every heavy command also requires --timing-owner <acknowledged-window-owner.json>.

Full fixtures, samples and the 1,000 ms ceiling are fixed. Each case has an external 60-second cap,
including worker startup/setup/cleanup. Build separately; preparation is also capped. Timeout is incomplete failure.
Layer measurements are not user-visible acceptance. Runtime quota profiles require isolated runtime control;
unsupported controls and missing phase evidence remain explicit coverage failures. See performance reference 0005.`);
    return;
  }
  const kind = option("--fixture") as Workload;
  const output = option("--output");
  if (!output || !["rich", "small"].includes(kind)) throw new Error("Pass --fixture rich|small and --output");
  const root = resolve(output);
  mkdirSync(root, { recursive: true });
  const emit = (data: object) => appendFileSync(join(root, "results.jsonl"), `${JSON.stringify(data)}\n`);
  const timingOwner = option("--timing-owner");
  if (!timingOwner) throw new Error("Pass --timing-owner from an acknowledged exclusive timing window");
  const finishWindow = enterMeasurementWindow(timingOwner, emit);
  try {
    emit({
      phase: "environment",
      command: process.argv,
      at: new Date().toISOString(),
      platform: platform(),
      os: release(),
      architecture: arch(),
      cpus: cpus(),
      totalMemory: totalmem(),
      freeMemory: freemem(),
      bun: Bun.version,
      commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", timeout: 1_000 }).trim(),
      powerMode: "unrecorded",
      physicalLowerSpecEvidence: "unavailable",
      limits: process.resourceUsage(),
      contract,
    });
    const layer = option("--layer");
    if (layer) {
      await runLayer(kind, root, layer, emit);
      emit({ phase: "coverage", layer, passed: false, failures: ["layer-measurement-is-not-full-acceptance"] });
      process.exitCode = 1;
      return;
    }
    const home = option("--home");
    if (!home && !process.argv.includes("--emit-fixture")) throw new Error("Pass a disposable --home");
    const containerConfig = option("--container-config");
    if (containerConfig) process.env.PSTDIO_SCALE_CONTAINER_CONFIG = resolve(containerConfig);
    const preparation = ["--emit-fixture", "--seed", "--refresh-source", "--verify-fixture"].find((flag) =>
      process.argv.includes(flag),
    );
    if (preparation) {
      await runPreparation(preparation, root, home, kind, emit);
      return;
    }
    if (!home) throw new Error("Pass a disposable --home");
    if (!existsSync(PACKAGED_BINARY_PATH)) throw new Error("Build the compiled binary separately before benchmarking");
    const profile = option("--profile", "native") as Profile;
    if (!(profile in contract.profiles)) throw new Error("Unknown CPU profile");
    const container = configuredContainer(home);
    if (contract.profiles[profile].runtimeCpus !== null && !container) {
      emit({
        phase: "coverage",
        profile,
        passed: false,
        failures: ["aggregate-runtime-quota-unavailable-in-native-driver"],
      });
      process.exitCode = 1;
      return;
    }
    await sampleScaleRuntime(home, root, kind, profile, emit, {
      operation: option("--operation"),
      background: option("--background"),
      sync: process.argv.includes("--sync"),
    });
    process.exitCode = 1;
  } finally {
    finishWindow();
  }
};

if (import.meta.main)
  runScaleDiagnostic().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
