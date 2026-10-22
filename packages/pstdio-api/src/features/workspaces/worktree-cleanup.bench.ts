import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { git } from "pstdio-wt";
import { cleanupWorkspaceWorktree } from "./worktree-cleanup";

// Run manually on a disposable filesystem, never against existing workspaces.
// BENCH_ROOT selects the filesystem; /tmp can be a RAM disk and is not the default.
const count = 28;
const filesPerWorkspace = Number(process.env.BENCH_FILES ?? 5000);
const repeats = Number(process.env.BENCH_REPEATS ?? 3);
const limits = (process.env.BENCH_LIMITS ?? "1,2,4,8,28").split(",").map(Number);
if (![filesPerWorkspace, repeats, ...limits].every((value) => Number.isSafeInteger(value) && value > 0)) {
  throw new Error("BENCH_FILES, BENCH_REPEATS, and BENCH_LIMITS must contain positive integers.");
}
const base = resolve(process.env.BENCH_ROOT ?? ".bench-worktree-cleanup");
mkdirSync(base, { recursive: true });
const root = mkdtempSync(join(base, "run-"));
const previousHome = process.env.PSTDIO_HOME;
process.env.PSTDIO_HOME = join(root, "home");

const percentile = (values: number[], fraction: number) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] ?? 0;
};

const cpuMicros = () => {
  try {
    const usage = readFileSync("/sys/fs/cgroup/cpu.stat", "utf8").match(/^usage_usec (\d+)/m)?.[1];
    return usage === undefined ? null : Number(usage);
  } catch {
    return null;
  }
};

const processRss = () => {
  let rss = process.memoryUsage().rss;
  try {
    const children = new Set(
      readdirSync("/proc/self/task").flatMap((task) => {
        try {
          return readFileSync(`/proc/self/task/${task}/children`, "utf8").trim().split(/\s+/).filter(Boolean);
        } catch {
          return [];
        }
      }),
    );
    for (const pid of children) {
      try {
        rss += Number(readFileSync(`/proc/${pid}/status`, "utf8").match(/^VmRSS:\s+(\d+)/m)?.[1] ?? 0) * 1024;
      } catch {
        // A Git process may exit between reading the child list and its memory use.
      }
    }
  } catch {
    // Other platforms still report the benchmark process RSS.
  }
  return rss / 1024 / 1024;
};

const repo = join(root, "repo");
mkdirSync(repo);
await git(repo, ["init", "-q"]);
await git(repo, ["config", "user.email", "benchmark@example.invalid"]);
await git(repo, ["config", "user.name", "Cleanup benchmark"]);
writeFileSync(join(repo, "README.md"), "Workspace cleanup fixture\n");
await git(repo, ["add", "."]);
await git(repo, ["commit", "-qm", "Fixture"]);

const prepare = async (run: string) => {
  const workspaces = [];
  for (let index = 0; index < count; index++) {
    const branch = `bench-${run}-${index}`;
    const worktreeRoot = join(root, "home", "workspaces", branch);
    await git(repo, ["worktree", "add", "-qb", branch, worktreeRoot]);
    for (let file = 0; file < filesPerWorkspace; file++) {
      const folder = join(worktreeRoot, "node_modules", `package-${Math.floor(file / 50)}`);
      if (file % 50 === 0) mkdirSync(folder, { recursive: true });
      writeFileSync(join(folder, `${file}.js`), "x".repeat(1024));
    }
    workspaces.push({
      provider_id: "pstdio.worktree",
      provider_ref_json: { data: { sourceRoot: repo, worktreeRoot } },
      branch,
    });
  }
  return workspaces;
};

const measure = async (workspaces: Awaited<ReturnType<typeof prepare>>, concurrency: number) => {
  let cursor = 0;
  let active = 0;
  let peakActive = 0;
  let peakRssMiB = processRss();
  let previousCpu = cpuMicros();
  const cpuStart = previousCpu;
  let previousTime = performance.now();
  const cpuPercent: number[] = [];
  const delays: number[] = [];
  const readLatency: number[] = [];
  const started = performance.now();
  let pendingRead: Promise<void> | undefined;
  const probe = setInterval(() => {
    const time = performance.now();
    const cpu = cpuMicros();
    if (cpu !== null && previousCpu !== null) {
      cpuPercent.push((cpu - previousCpu) / (time - previousTime) / 10);
    }
    delays.push(Math.max(0, time - previousTime - 50));
    previousCpu = cpu;
    previousTime = time;
    peakRssMiB = Math.max(peakRssMiB, processRss());
    if (!pendingRead) {
      const readStart = performance.now();
      pendingRead = readFile(join(repo, "README.md"))
        .then(() => {
          readLatency.push(performance.now() - readStart);
        })
        .finally(() => {
          pendingRead = undefined;
        });
    }
  }, 50);
  try {
    await Promise.all(
      Array.from({ length: concurrency }, async () => {
        while (cursor < workspaces.length) {
          const workspace = workspaces[cursor++];
          active++;
          peakActive = Math.max(peakActive, active);
          try {
            await cleanupWorkspaceWorktree({} as never, workspace);
          } finally {
            active--;
          }
        }
      }),
    );
  } finally {
    clearInterval(probe);
    await pendingRead;
  }
  const cpuEnd = cpuMicros();
  return {
    concurrency,
    elapsedMs: Math.round(performance.now() - started),
    cpuMs: cpuEnd !== null && cpuStart !== null ? Math.round((cpuEnd - cpuStart) / 1000) : null,
    cpuP95Percent: cpuPercent.length ? Math.round(percentile(cpuPercent, 0.95)) : null,
    peakRssMiB: Math.round(peakRssMiB),
    loopDelayP95Ms: Number(percentile(delays, 0.95).toFixed(1)),
    readLatencyP95Ms: Number(percentile(readLatency, 0.95).toFixed(1)),
    peakActive,
  };
};

try {
  console.log(JSON.stringify({ platform: process.platform, count, filesPerWorkspace, repeats, root }));
  for (let repeat = 0; repeat < repeats; repeat++) {
    // Rotate order to reduce bias from which concurrency runs first.
    const ordered = [...limits.slice(repeat % limits.length), ...limits.slice(0, repeat % limits.length)];
    for (const limit of ordered) {
      const workspaces = await prepare(`${repeat}-${limit}`);
      const result = await measure(workspaces, limit);
      if (workspaces.some((workspace) => existsSync(workspace.provider_ref_json.data.worktreeRoot))) {
        throw new Error("Cleanup left a benchmark worktree on disk.");
      }
      console.log(JSON.stringify({ repeat, ...result }));
    }
  }
} finally {
  if (previousHome === undefined) delete process.env.PSTDIO_HOME;
  else process.env.PSTDIO_HOME = previousHome;
  rmSync(root, { recursive: true, force: true });
}
