import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, posix } from "node:path";

const documentation = (path: string) => /\.(md|mdx|txt)$/i.test(path) || /(^|\/)(docs|documentation)\//.test(path);
const maintainedTest = (path: string) => /\.test\.tsx?$/.test(path) && !/(^|\/)test-helpers?\.test\.tsx?$/.test(path);

export const partitionFocusedFiles = (files: string[], maxShards: number, targetFilesPerRow: number) => {
  if (!files.length) return [];
  // Row size is a scheduling threshold, not a test budget. Keep the queue's
  // shard cap and retain every selected file even when a row exceeds the target.
  const count = Math.min(maxShards, Math.ceil(files.length / targetFilesPerRow));
  const rows: string[][] = Array.from({ length: count }, () => []);
  for (const [index, file] of [...files].sort().entries()) rows[index % count].push(file);
  return rows;
};

const nearestOwner = (changed: string, directory: string, tests: string[]) => {
  let owner = posix.dirname(changed);
  const containers = new Set([directory, `${directory}/src`, `${directory}/src/features`, `${directory}/src/services`]);
  while (!containers.has(owner) && owner.startsWith(`${directory}/`)) {
    const files = tests.filter((path) => path.startsWith(`${owner}/`));
    if (files.length) return { owner, files };
    owner = posix.dirname(owner);
  }
};

export const selectFocusedTestFiles = (root: string, packageDir: string, changedFiles: string[]) => {
  const directory = packageDir.replaceAll("\\", "/").replace(/\/$/, "");
  const owned = changedFiles
    .map((path) => path.replaceAll("\\", "/"))
    .filter((path) => path.startsWith(`${directory}/`));
  if (!owned.length)
    return { files: [], reason: "consumer-only change; full queue checks retain package integration coverage" };
  const relevant = owned.filter((path) => !documentation(path));
  if (!relevant.length) return { files: [], reason: "package documentation-only change" };

  const tracked = spawnSync("git", ["ls-files", "-z", "--", directory], { cwd: root, encoding: "utf8" });
  if (tracked.status !== 0) throw new Error(`Cannot discover tracked tests: ${tracked.stderr}`);
  const tests = tracked.stdout
    .split("\0")
    .filter((path) => maintainedTest(path) && existsSync(join(root, path)))
    .sort();
  const selected = new Set<string>();
  const reasons: string[] = [];
  for (const changed of relevant) {
    const stem = changed.replace(/\.(?:test\.)?tsx?$/, "");
    const adjacent = tests.filter(
      (path) => path === changed || path === `${stem}.test.ts` || path === `${stem}.test.tsx`,
    );
    if (adjacent.length) {
      for (const path of adjacent) selected.add(path);
      reasons.push(`adjacent tests for ${posix.relative(directory, changed)}`);
      continue;
    }
    const nearest = nearestOwner(changed, directory, tests);
    if (nearest) {
      for (const path of nearest.files) selected.add(path);
      reasons.push(`nearest owner ${posix.relative(directory, nearest.owner)}`);
      continue;
    }
    if (!tests.length) throw new Error(`${directory}: no maintained tests exist for whole-package fallback`);
    return {
      files: tests.map((path) => posix.relative(directory, path)),
      reason: `whole-package fallback: ${posix.relative(directory, changed)} has no narrower meaningful test owner`,
    };
  }
  return {
    files: [...selected].map((path) => posix.relative(directory, path)).sort(),
    reason: [...new Set(reasons)].join("; "),
  };
};
