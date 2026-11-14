import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

// Hash executable workload source, not formatting/comments. Product implementation repairs
// outside these owners keep the same workload series. Harness repairs can retain revision 1.
export const workloadSource = (file: string) =>
  file.startsWith("packages/benchmarks/src/") ||
  /^scripts\/ci\/(.*benchmark.*|production-performance.*|production-platforms)\.ts$/.test(file) ||
  /^\.github\/workflows\/(benchmarks|production-performance|production-desktop|verify-windows-signing|source-benchmarks)\.yml$/.test(
    file,
  ) ||
  file.startsWith("packages/e2e/src/perf/critical/") ||
  /^packages\/e2e\/src\/(packaged|helpers)\/.*(helpers|source|folder-project)\.ts$/.test(file) ||
  /^packages\/e2e\/src\/perf\/desktop-memory-(app|samples)\.ts$/.test(file) ||
  file.startsWith("packages/storage-scale-fixture/") ||
  file.startsWith("packages/workbench-fixture/") ||
  /scripts\/dev\/(seed-planner-stress|planner-stress-data)\.ts$/.test(file) ||
  /packages\/pstdio-db\/src\/services\/extension-storage\/(critical-store\.p3\.bench|database-scale-fixture)\.ts$/.test(
    file,
  ) ||
  file === "packages/e2e/src/local-workspace-registry.ts" ||
  file === "packages/pstdio-api/src/benchmark-counters.ts";

export const normalizedSource = (file: string, source: string) => {
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  if (!/\.[cm]?tsx?$/.test(file)) return source.trim();
  return ts.createPrinter({ removeComments: true, newLine: ts.NewLineKind.LineFeed }).printFile(parsed);
};
export const sourceDigest = (entries: [string, string][]) =>
  createHash("sha256")
    .update(
      JSON.stringify(
        entries.sort(([a], [b]) => a.localeCompare(b)).map(([file, source]) => [file, normalizedSource(file, source)]),
      ),
    )
    .digest("hex");
export const catalogDigest = (root: string) => {
  const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], {
    cwd: root,
    encoding: "utf8",
  })
    .split("\0")
    .filter((file) => workloadSource(file) && existsSync(join(root, file)));
  return sourceDigest(files.map((file) => [file, readFileSync(join(root, file), "utf8")]));
};

export const readContract = (root: string) => {
  const lock = JSON.parse(readFileSync(join(root, "packages/benchmarks/catalog.lock.json"), "utf8")) as {
    revision: number;
    digest: string;
    authorization: string;
  };
  if (lock.revision !== 1 || lock.digest !== catalogDigest(root))
    throw new Error(
      "Frozen workload source changed; update the authorized contract in a benchmark-labeled PR for human review and merge",
    );
  return lock;
};
