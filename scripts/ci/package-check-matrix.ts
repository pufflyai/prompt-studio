export const partitionPackageChecks = (packages: string[]) => {
  const selected = [...new Set(packages)].sort();
  const rows = Array.from({ length: Math.min(4, selected.length) }, () => [] as string[]);
  selected.forEach((name, index) => {
    rows[index % rows.length].push(name);
  });
  return rows.map((packages, index) => ({
    shard: `${index + 1}/${rows.length}`,
    packages,
    lernaFilter: packages.map((name) => `--scope ${name}`).join(" "),
  }));
};
