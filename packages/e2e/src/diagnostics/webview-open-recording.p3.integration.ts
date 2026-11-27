// Temporary diagnostic branch only; production binaries come from the two exact commits below.

import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { cpus, release, tmpdir, totalmem } from "node:os";
import { join, resolve } from "node:path";

const baseline = "c237d96bb5b7deb04d02b06c8e33e8cbb5f6bb01";
const candidate = "a47cd5d568e5798154a386b508db0cd091fb484e";
const repo = resolve(import.meta.dirname, "../../../..");
const output = join(repo, "packages/e2e/test-results/webview-recording");
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
      PANEL_COHORT: "recording-only-c237-a47-v12",
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
    workloads: ["recording only:1 ticket"],
    endpoint: "click to exact visible content after two animation frames",
    at: new Date().toISOString(),
  };
  await Bun.write(join(output, "protocol.json"), JSON.stringify(metadata, null, 2));
  console.log("PAIR_PROTOCOL", JSON.stringify(metadata));
  // Separate recordings only; no qualification samples or statistics in this job.
  for (const label of ["A", "B"]) await sample("small", "recording", label, true);
  await Bun.write(join(output, "final-outcome.json"), JSON.stringify({ purpose: "recording-only", failures }, null, 2));
  if (failures.length) throw new Error("Recording incomplete; preserve all artifacts");
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
