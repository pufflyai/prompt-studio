// Temporary diagnostic branch only; production binaries come from the two exact commits below.

import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { cpus, release, tmpdir, totalmem } from "node:os";
import { join, resolve } from "node:path";

const baseline = "c237d96bb5b7deb04d02b06c8e33e8cbb5f6bb01";
const candidate = "a47cd5d568e5798154a386b508db0cd091fb484e";
const repo = resolve(import.meta.dirname, "../../../..");
const output = join(repo, "packages/e2e/test-results/webview-comparison");
if (existsSync(output)) throw new Error("Preserve existing comparison output");
mkdirSync(output, { recursive: true });
const temporary = mkdtempSync(join(tmpdir(), "webview-production-comparison-"));
const checkout = join(temporary, "source");
const binaries: Record<string, { path: string; revision: string; sha256: string }> = {};
const failures: { workload: string; pair: string; label: string; exitCode: number }[] = [];
const run = async (argv: string[], cwd: string, env: NodeJS.ProcessEnv = {}) => {
  console.log("DIAGNOSTIC_SETUP", JSON.stringify({ argv, cwd }));
  const child = Bun.spawn(argv, { cwd, env: { ...process.env, ...env }, stdio: ["ignore", "inherit", "inherit"] });
  const code = await child.exited;
  if (code) throw new Error(`Setup exited ${code}: ${argv.join(" ")}`);
};
const rows = (name: string) => {
  const file = join(output, name);
  return existsSync(file)
    ? readFileSync(file, "utf8")
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line))
    : [];
};
const statistic = (samples: number[]) => {
  const sorted = [...samples].sort((a, b) => a - b);
  return { samples, median: sorted[Math.floor(sorted.length / 2)], max: sorted.at(-1) };
};
const sample = async (workload: string, pair: string, label: string, recording = false) => {
  const binary = binaries[label]!;
  const script = workload === "module" ? "large-module-first-open.sample.ts" : "planner-first-open.sample.ts";
  console.log("PAIR_START", JSON.stringify({ workload, pair, label, recording, at: new Date().toISOString() }));
  const child = Bun.spawn(["bun", join(import.meta.dirname, script)], {
    cwd: repo,
    env: {
      ...process.env,
      PANEL_BINARY: binary.path,
      PANEL_REVISION: binary.revision,
      PANEL_LABEL: recording ? `Recording-${workload}-${label}` : label,
      PANEL_PAIR: pair,
      PANEL_CASE: workload,
      PANEL_COHORT: "frozen-c237-a47-github-v11",
      PANEL_TICKETS: workload === "small" ? "1" : "5000",
      PANEL_OUTPUT: output,
      ...(recording
        ? {
            PANEL_VIDEO_DIR: join(output, `recording-${workload}-${label}`),
            PANEL_VIDEO_LABEL: `${label === "A" ? "Before" : "After"} · ${binary.revision.slice(0, 10)} · ${workload === "small" ? "1 ticket" : "5000 tickets"}`,
          }
        : {}),
    },
    stdio: ["ignore", "inherit", "inherit"],
  });
  const exitCode = await child.exited;
  if (exitCode) failures.push({ workload: recording ? `recording-${workload}` : workload, pair, label, exitCode });
  console.log(
    "PAIR_FINISHED",
    JSON.stringify({ workload, pair, label, recording, exitCode, at: new Date().toISOString() }),
  );
};
try {
  await run(
    ["bun", join(repo, "packages/e2e/node_modules/@playwright/test/cli.js"), "install", "--with-deps", "chromium"],
    repo,
  );
  // The controller's unchanged public test helpers need their normal compiled workspace dependencies.
  await run(["bun", "run", "build", "--", "--scope", "pstdio", "--include-dependencies"], repo, {
    PSTDIO_EXTENSION_RELEASE_REF: candidate,
  });
  // This is a disposable build fixture, not an implementation workspace.
  await run(["git", "clone", "--shared", "--no-checkout", repo, checkout], repo);
  for (const [label, revision] of [
    ["A", baseline],
    ["B", candidate],
  ]) {
    await run(["git", "checkout", "--force", "--detach", revision!], checkout);
    await run(["git", "diff", "--exit-code"], checkout);
    await run(["bun", "install", "--frozen-lockfile", "--concurrent-scripts", "1"], checkout);
    await run(["bun", "run", "build", "--", "--scope", "pstdio", "--include-dependencies"], checkout, {
      PSTDIO_EXTENSION_RELEASE_REF: revision,
    });
    const path = join(temporary, `${label}.bin`);
    copyFileSync(join(checkout, "dist/pstdio"), path);
    chmodSync(path, 0o755);
    const sha256 = new Bun.CryptoHasher("sha256").update(await Bun.file(path).arrayBuffer()).digest("hex");
    binaries[label!] = { path, revision: revision!, sha256 };
  }
  const metadata = {
    baseline,
    candidate,
    binaries,
    bun: Bun.version,
    platform: process.platform,
    arch: process.arch,
    cpu: cpus()[0]?.model,
    osRelease: release(),
    totalmem: totalmem(),
    orders: ["AB", "BA", "AB", "BA", "AB"],
    workloads: ["module:64×65536 bytes", "small:1 ticket", "planner:5000 tickets,200-row window"],
    endpoint: "click to exact visible content after two animation frames",
    at: new Date().toISOString(),
  };
  await Bun.write(join(output, "protocol.json"), JSON.stringify(metadata, null, 2));
  console.log("PAIR_PROTOCOL", JSON.stringify(metadata));
  for (const workload of ["module", "small", "planner"])
    for (let pair = 0; pair < 5; pair++)
      for (const label of pair % 2 ? ["B", "A"] : ["A", "B"]) await sample(workload, String(pair + 1), label);
  const all = [...rows("planner-results.jsonl"), ...rows("module-results.jsonl")];
  const summary = Object.fromEntries(
    ["module", "small", "planner"].map((workload) => {
      const selected = all.filter((row) => row.workload === workload);
      const a = statistic(selected.filter((row) => row.label === "A").map((row) => row.elapsed));
      const b = statistic(selected.filter((row) => row.label === "B").map((row) => row.elapsed));
      const complete =
        a.samples.length === 5 && b.samples.length === 5 && !failures.some((row) => row.workload === workload);
      return [
        workload,
        {
          baseline: a,
          candidate: b,
          complete,
          medianImprovementPercent: complete ? 100 * (1 - b.median! / a.median!) : null,
          maximumImprovementPercent: complete ? 100 * (1 - b.max! / a.max!) : null,
        },
      ];
    }),
  );
  await Bun.write(join(output, "summary.json"), JSON.stringify({ ...metadata, summary, failures }, null, 2));
  console.log("PAIR_COMPLETE", JSON.stringify({ summary, failures }));
  // Recording overhead never enters the timing files or statistics.
  for (const workload of ["small", "planner"])
    for (const label of ["A", "B"]) await sample(workload, "recording", label, true);
  await Bun.write(join(output, "final-outcome.json"), JSON.stringify({ summary, failures }, null, 2));
  if (failures.length || Object.values(summary).some((result) => !result.complete))
    throw new Error("Comparison or recording incomplete; preserve failures and raw artifacts");
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
