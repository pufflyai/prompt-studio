import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile } from "node:fs/promises";
import os from "node:os";
import { join, relative, resolve } from "node:path";

const args = process.argv.slice(2);
assert(
  args.length === 2 && args[0] === "--out" && args[1],
  "Usage: bun scripts/experiments/ps239.ts --out <report filesPath>",
);
const output = resolve(args[1]);
const root = resolve(import.meta.dirname, "../..");
await mkdir(output, { recursive: true });
const sources = [
  "packages/pstdio-db/src/experiments/ps239",
  "extensions/pstdio-planner/src/proposals/PS-239",
  "packages/pstdio-workbench/src/proposals/PS-239",
  "scripts/experiments/ps239.ts",
];
const hashes: Record<string, string> = {};
for (const source of sources) {
  const files = source.endsWith(".ts")
    ? [source]
    : (await readdir(join(root, source))).map((name) => join(source, name));
  for (const file of files)
    hashes[file] = createHash("sha256")
      .update(await readFile(join(root, file)))
      .digest("hex");
}
const steps = [
  ...[100, 1000, 5000].map((count) => ({
    name: `db-${count}`,
    cwd: "packages/pstdio-db",
    script: "src/experiments/ps239/run.diagnostic.ts",
    args: ["--count", String(count), "--samples", "12"],
  })),
  { name: "refresh", cwd: "packages/pstdio-workbench", script: "src/proposals/PS-239/refresh.diagnostic.ts", args: [] },
  { name: "enrichment", cwd: "extensions/pstdio-planner", script: "src/proposals/PS-239/run.diagnostic.ts", args: [] },
  { name: "editor", cwd: "packages/pstdio-workbench", script: "src/proposals/PS-239/run.diagnostic.ts", args: [] },
];
const manifest = {
  baseline: "1e22f30df08f66b40743c63e3c8af4da8d6d3817",
  revision: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
  sourceChanges: execFileSync("git", ["status", "--short"], { cwd: root, encoding: "utf8" }).trim(),
  hashes,
  started: new Date().toISOString(),
  host: {
    platform: os.platform(),
    release: os.release(),
    cpu: os.cpus()[0]?.model,
    memoryBytes: os.totalmem(),
    arch: os.arch(),
    bun: Bun.version,
  },
  scope: "First-pass source diagnostics; NOT the B/V1–V5 browser matrix, disk durability, or ticket acceptance",
  steps: steps.map((step) => ({ ...step, status: "unrun", exit: null as number | null, elapsedMs: 0 })),
};
const persist = () => Bun.write(join(output, "run-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
await persist();
for (const step of manifest.steps) {
  const command = ["bun", step.script, ...step.args, "--out", join(output, step.name)];
  const started = performance.now();
  const child = Bun.spawn(command, {
    cwd: join(root, step.cwd),
    stdout: Bun.file(join(output, `${step.name}.log`)),
    stderr: "pipe",
  });
  const errorOutput = await new Response(child.stderr).text();
  step.exit = await child.exited;
  step.elapsedMs = performance.now() - started;
  step.status = step.exit === 0 ? "complete" : "failed";
  await Bun.write(join(output, `${step.name}.stderr.log`), errorOutput);
  await persist();
  console.log(`${step.name}: ${step.status} (${Math.round(step.elapsedMs)} ms)`);
  if (step.exit !== 0)
    throw new Error(`${step.name} failed; inspect ${relative(root, output)}/${step.name}.stderr.log`);
}

const median = (values: number[]) => {
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
};
const groups = new Map<
  string,
  { key: string; samples: number[]; bytes: number[]; reads: number[]; freshness: number[] }
>();
for (const step of manifest.steps.filter((step) => step.name !== "editor")) {
  const rows = await Bun.file(join(output, step.name, "samples.json")).json();
  for (const row of rows) {
    const key = JSON.stringify([
      step.name,
      row.experiment ?? step.name,
      row.kind ?? row.bounded ?? row.candidate ?? row.selected,
      row.phase ?? row.name,
      row.count,
      row.dense,
    ]);
    const group = groups.get(key) ?? { key, samples: [], bytes: [], reads: [], freshness: [] };
    if (typeof row.ms === "number") group.samples.push(row.ms);
    if (typeof row.bytes === "number") group.bytes.push(row.bytes);
    if (typeof row.reads === "number") group.reads.push(row.reads);
    if (typeof row.finalFreshnessMs === "number") group.freshness.push(row.finalFreshnessMs);
    groups.set(key, group);
  }
}
const describe = (values: number[]) =>
  values.length
    ? { n: values.length, median: median(values), min: Math.min(...values), max: Math.max(...values), first: values[0] }
    : undefined;
await Bun.write(
  join(output, "summary.json"),
  `${JSON.stringify(
    [...groups.values()].map((group) => ({
      key: JSON.parse(group.key),
      ms: describe(group.samples),
      bytes: describe(group.bytes),
      reads: describe(group.reads),
      freshnessMs: describe(group.freshness),
    })),
    null,
    2,
  )}\n`,
);
console.log(JSON.stringify({ output, status: "complete", qualification: "diagnostic prototype only" }));
