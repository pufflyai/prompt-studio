import { execFileSync, spawnSync } from "node:child_process";
import { appendFileSync, closeSync, cpSync, mkdirSync, openSync, rmSync } from "node:fs";
import { arch, cpus, freemem, platform, release, totalmem } from "node:os";
import { join, resolve } from "node:path";
import { contract, type Profile, type Workload } from "storage-scale-fixture";
import { buildBinary } from "../packaged/packaged-helpers";
import { writeFixture } from "./storage-scale-artifacts";
import { applyContainerProfile, configuredContainer } from "./storage-scale-container";
import { refreshScaleSources, seedScaleRuntime } from "./storage-scale-runtime";
import { sampleScaleRuntime } from "./storage-scale-samples";
import { verifyScaleFixture } from "./storage-scale-verify";
import { enterMeasurementWindow } from "./storage-scale-window";

const option = (flag: string, fallback?: string) => {
  const at = process.argv.indexOf(flag);
  if (at === -1) return fallback;
  if (!process.argv[at + 1] || process.argv[at + 1].startsWith("--")) throw new Error(`Missing ${flag} value`);
  return process.argv[at + 1];
};

const runLayer = (kind: Workload, root: string, layer: string) => {
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
      ? [""]
      : ["seed", ...(process.argv.includes("--churn") ? ["churn"] : []), ...Array(10).fill("sample")];
  for (const phase of phases) {
    const args = [script, kind, String(count)];
    const snapshot = join(root, "database-work");
    const sampleRoot = join(root, "database-sample");
    if (layer === "database") {
      if (phase === "sample") {
        rmSync(sampleRoot, { recursive: true, force: true });
        cpSync(snapshot, sampleRoot, { recursive: true });
      }
      args.push(phase === "sample" ? sampleRoot : snapshot, phase);
    } else if (process.argv.includes("--churn")) args.push("churn");
    const stdout = openSync(join(root, `${layer}.jsonl`), "a");
    const stderr = openSync(join(root, `${layer}.stderr.log`), "a");
    try {
      const run = spawnSync("bun", args, { cwd: repo, stdio: ["ignore", stdout, stderr] });
      if (run.status !== 0) throw new Error(`Layer worker exited ${run.status}; inspect ${layer}.stderr.log`);
    } finally {
      closeSync(stdout);
      closeSync(stderr);
    }
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

Full fixtures, samples and the 1,000 ms ceiling are fixed. Nonzero exit records a diagnostic failure.
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
      commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
      powerMode: "unrecorded",
      physicalLowerSpecEvidence: "unavailable",
      limits: process.resourceUsage(),
      contract,
    });
    if (process.argv.includes("--emit-fixture")) {
      const fixture = await writeFixture(join(root, "fixture"), kind);
      emit({ phase: "fixture", ...fixture, scenarios: undefined });
      return;
    }
    const layer = option("--layer");
    if (layer) {
      runLayer(kind, root, layer);
      emit({ phase: "coverage", layer, passed: false, failures: ["layer-measurement-is-not-full-acceptance"] });
      process.exitCode = 1;
      return;
    }
    const home = option("--home");
    if (!home) throw new Error("Pass a disposable --home");
    const containerConfig = option("--container-config");
    if (containerConfig) process.env.PSTDIO_SCALE_CONTAINER_CONFIG = resolve(containerConfig);
    buildBinary();
    if (process.argv.includes("--seed")) {
      await writeFixture(join(root, "fixture"), kind);
      emit({ phase: "seed", ...(await seedScaleRuntime(resolve(home), kind, process.argv.includes("--churn"))) });
      await refreshScaleSources(resolve(home), kind);
      emit({ phase: "stored-fixture", ...(await verifyScaleFixture(resolve(home), kind)) });
      return;
    }
    if (process.argv.includes("--refresh-source")) {
      await refreshScaleSources(resolve(home), kind);
      return;
    }
    if (process.argv.includes("--verify-fixture")) {
      emit({ phase: "stored-fixture", ...(await verifyScaleFixture(resolve(home), kind)) });
      return;
    }
    const profile = option("--profile", "native") as Profile;
    if (!(profile in contract.profiles)) throw new Error("Unknown CPU profile");
    const container = configuredContainer(home);
    if (container) emit({ phase: "runtime-control", profile, ...applyContainerProfile(container, profile) });
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
