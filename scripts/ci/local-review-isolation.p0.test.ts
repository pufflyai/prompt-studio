import { expect, spyOn, test } from "bun:test";
import { execFileSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runLocalReview } from "./run-local-review";

const fixture = () => {
  const root = mkdtempSync(join(tmpdir(), "review-bootstrap-"));
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  const commit = () => {
    git("add", ".");
    git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.test", "commit", "-qm", "fixture");
  };
  cpSync(import.meta.dirname, join(root, "scripts/ci"), {
    recursive: true,
    filter: (path) => !path.endsWith(".test.ts"),
  });
  const benchmark = join(root, "packages/benchmarks");
  mkdirSync(benchmark, { recursive: true });
  cpSync(join(import.meta.dirname, "../../packages/benchmarks/package.json"), join(benchmark, "package.json"));
  cpSync(join(import.meta.dirname, "../../packages/benchmarks/src"), join(benchmark, "src"), {
    recursive: true,
    filter: (path) => !path.endsWith(".test.ts"),
  });
  writeFileSync(join(root, "package.json"), JSON.stringify({ workspaces: ["packages/*"] }));
  writeFileSync(join(root, ".gitignore"), "test-results\nnode_modules\nbun.lock\n");
  git("init", "-q");
  commit();
  const base = git("rev-parse", "HEAD");
  writeFileSync(join(root, "README.md"), "# Fixture\n");
  commit();
  return { root, base, git, commit };
};

test("a clean workspace prints a review plan before any dependency installation", () => {
  const { root, base } = fixture();
  try {
    const output = execFileSync(process.execPath, ["scripts/ci/run-local-review.ts", "--base", base, "--list"], {
      cwd: root,
      encoding: "utf8",
    });
    const plan = JSON.parse(output);
    expect(plan.changed).toEqual(["README.md"]);
    expect(plan.selected).toEqual([]);
    expect(plan.setup).toEqual([]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("dirty source is rejected before scratch setup begins", async () => {
  const { root, base } = fixture();
  try {
    writeFileSync(join(root, "README.md"), "changed");
    await expect(runLocalReview(root, base, [])).rejects.toThrow("Commit the candidate");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("two over-target review runs finish with private checkouts, dependencies, homes and evidence", async () => {
  if (process.platform === "win32") return;
  const { root, git, commit } = fixture();
  const scratch: string[] = [];
  const clock = spyOn(Date, "now");
  try {
    // Real tiny workspace, with no downloads or application builds.
    const benchmarkPath = join(root, "packages/benchmarks/package.json");
    const benchmark = JSON.parse(readFileSync(benchmarkPath, "utf8"));
    writeFileSync(
      benchmarkPath,
      JSON.stringify({ name: benchmark.name, type: benchmark.type, exports: benchmark.exports, main: benchmark.main }),
    );
    writeFileSync(join(root, "package.json"), JSON.stringify({ workspaces: ["packages/*", "scripts"] }));
    writeFileSync(
      join(root, "scripts/package.json"),
      JSON.stringify({ name: "pstdio-scripts", scripts: { "verify:docs-links": "bun fixture-check.ts" } }),
    );
    writeFileSync(
      join(root, "scripts/fixture-check.ts"),
      `
      import {mkdirSync,writeFileSync} from 'node:fs';
      import {join} from 'node:path';
      const home=process.env.PSTDIO_HOME;
      mkdirSync(home,{recursive:true});
      writeFileSync(join(home,'fixture.json'),JSON.stringify({cwd:process.cwd(),cache:process.env.BUN_INSTALL_CACHE_DIR}));
    `,
    );
    writeFileSync(join(root, ".gitignore"), "test-results\nnode_modules\n");
    execFileSync(process.execPath, ["install", "--lockfile-only"], { cwd: root, stdio: "pipe" });
    commit();
    const base = git("rev-parse", "HEAD");
    writeFileSync(join(root, "README.md"), "# Changed documentation\n");
    commit();
    let now = Date.now();
    clock.mockImplementation(() => now);
    const runs = [runLocalReview(root, base, []), runLocalReview(root, base, [])];
    // Advance elapsed time past the target while both real executions are setting up.
    now += 16 * 60 * 1000;
    expect(await Promise.all(runs)).toEqual([0, 0]);
    const reports = readdirSync(join(root, "test-results/local-review")).map((file) =>
      JSON.parse(readFileSync(join(root, "test-results/local-review", file), "utf8")),
    );
    scratch.push(...reports.map((report) => report.directory));
    expect(reports).toHaveLength(2);
    expect(reports[0].source).not.toBe(reports[1].source);
    expect(reports.every((report) => report.outcome === "local_passed")).toBe(true);
    expect(reports.every((report) => report.exceededTarget && report.elapsedMs > report.targetMs)).toBe(true);
    for (const report of reports) {
      const observed = JSON.parse(readFileSync(join(report.directory, "runtime-home/fixture.json"), "utf8"));
      expect(realpathSync(observed.cwd)).toBe(realpathSync(join(report.source, "scripts")));
      expect(observed.cache).toBe(join(report.directory, "bun-cache"));
      writeFileSync(join(report.source, "README.md"), "private mutation");
    }
    expect(readFileSync(join(root, "README.md"), "utf8")).toBe("# Changed documentation\n");
    expect(git("status", "--porcelain")).toBe("");
  } finally {
    clock.mockRestore();
    // Failed runs also retain their report, allowing their private fixture paths to be removed.
    const reportDirectory = join(root, "test-results/local-review");
    try {
      for (const file of readdirSync(reportDirectory))
        scratch.push(JSON.parse(readFileSync(join(reportDirectory, file), "utf8")).directory);
    } catch {
      /* Setup may have failed before a report exists. */
    }
    for (const directory of new Set(scratch)) rmSync(directory, { recursive: true, force: true });
    rmSync(root, { recursive: true, force: true });
  }
});
