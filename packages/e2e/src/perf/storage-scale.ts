import { execFileSync, spawnSync } from "node:child_process";
import { appendFileSync, mkdirSync } from "node:fs";
import { arch, cpus, freemem, platform, release, totalmem } from "node:os";
import { join, resolve } from "node:path";
import { contract, type Profile, type Workload } from "storage-scale-fixture";
import { buildBinary } from "../packaged/packaged-helpers";
import { writeFixture } from "./storage-scale-artifacts";
import { seedScaleRuntime } from "./storage-scale-runtime";
import { sampleScaleRuntime } from "./storage-scale-samples";

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
  const phases = layer === "sync" ? [""] : ["seed", ...Array(10).fill("sample")];
  for (const phase of phases) {
    const args = [script, kind, String(count)];
    if (layer === "database") args.push(join(root, "database-work"), phase);
    else if (process.argv.includes("--churn")) args.push("churn");
    const run = spawnSync("bun", args, { cwd: repo, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    appendFileSync(join(root, `${layer}.jsonl`), run.stdout);
    if (run.status !== 0) throw new Error(run.stderr || `Layer worker exited ${run.status}`);
  }
};

export const runScaleDiagnostic = async () => {
  if (process.argv.includes("--help")) {
    console.log(`Diagnostic storage scale baseline (not a required release check).
  --fixture rich|small --output <directory> --emit-fixture
  --fixture rich|small --output <directory> --home <disposable-directory> --seed [--churn]
  --fixture rich|small --output <directory> --home <seeded-directory> --measure --profile native|renderer
  --fixture rich|small --output <directory> --layer sync|database --rows 1000|10000|100000

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
  buildBinary();
  if (process.argv.includes("--seed")) {
    await writeFixture(join(root, "fixture"), kind);
    emit({ phase: "seed", ...(await seedScaleRuntime(resolve(home), kind, process.argv.includes("--churn"))) });
    return;
  }
  const profile = option("--profile", "native") as Profile;
  if (!(profile in contract.profiles)) throw new Error("Unknown CPU profile");
  if (contract.profiles[profile].runtimeCpus !== null) {
    emit({
      phase: "coverage",
      profile,
      passed: false,
      failures: ["aggregate-runtime-quota-unavailable-in-native-driver"],
    });
    process.exitCode = 1;
    return;
  }
  await sampleScaleRuntime(home, root, kind, profile, emit);
  emit({
    phase: "coverage",
    passed: false,
    failures: [
      "indexed-query-api-unavailable",
      "complete-view-readiness-unproved",
      "sync-background-matrix-not-integrated",
      "durable-edit-ui-matrix-not-integrated",
      "kill-restart-and-offline-merge-matrix-not-integrated",
    ],
  });
  process.exitCode = 1;
};

if (import.meta.main)
  runScaleDiagnostic().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
