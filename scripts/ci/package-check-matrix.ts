import { shardTestFiles } from "./test-file-shards";
export const partitionPackageChecks = (packages: string[], maximum = 4, timings?: Record<string, number>) => {
  const selected = [...new Set(packages)].sort();
  const count = Math.min(maximum, selected.length);
  const rows = Array.from(
    { length: count },
    (_, index) => shardTestFiles(selected, { shard: `${index + 1}/${count}`, timings }).files,
  );
  return rows.map((packages, index) => ({
    shard: `${index + 1}/${rows.length}`,
    packages,
    lernaFilter: packages.map((name) => `--scope ${name}`).join(" "),
  }));
};
