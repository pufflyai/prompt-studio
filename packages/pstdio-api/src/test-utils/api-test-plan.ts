interface PlanOptions {
  files?: string[];
  shard?: string;
  timings?: Record<string, number>;
}
const normalize = (path: string) => path.replaceAll("\\", "/").replace(/^\.\//, "");

export const createApiTestPlan = (discovered: string[], options: PlanOptions = {}) => {
  const available = [...new Set(discovered.map(normalize))].sort();
  const selected = options.files?.map(normalize).sort() ?? available;
  if (!selected.length) throw new Error("API test selection is empty");
  if (new Set(selected).size !== selected.length) throw new Error("Duplicate API test selection");
  for (const file of selected) if (!available.includes(file)) throw new Error(`Unknown API test file: ${file}`);
  const shard = options.shard ?? "1/1";
  if (!/^[1-9]\d*\/[1-9]\d*$/.test(shard)) throw new Error(`Invalid API shard: ${shard}`);
  const [index, count] = shard.split("/").map(Number) as [number, number];
  if (index > count) throw new Error(`Invalid API shard: ${shard}`);
  const timings = Object.fromEntries(
    Object.entries(options.timings ?? {}).map(([file, duration]) => [normalize(file), duration]),
  );
  for (const file of selected) {
    if (timings[file] !== undefined && (!Number.isFinite(timings[file]) || timings[file]! < 0)) {
      throw new Error(`Invalid API duration for ${file}`);
    }
  }
  if (!Object.keys(timings).length) {
    return {
      selected,
      files: selected.filter((_, position) => position % count === index - 1),
      shard,
      balanced: false,
    };
  }
  const measured = selected
    .map((file) => timings[file])
    .filter((value): value is number => value !== undefined)
    .sort((a, b) => a - b);
  const fallback = measured[Math.floor(measured.length / 2)] ?? 1;
  const duration = (file: string) => timings[file] ?? fallback;
  const shards = Array.from({ length: count }, () => ({ files: [] as string[], duration: 0 }));
  for (const file of [...selected].sort((a, b) => duration(b) - duration(a) || a.localeCompare(b))) {
    const target = shards.reduce((best, candidate) =>
      candidate.duration < best.duration ||
      (candidate.duration === best.duration && candidate.files.length < best.files.length)
        ? candidate
        : best,
    );
    target.files.push(file);
    target.duration += duration(file);
  }
  return { selected, files: shards[index - 1]!.files, shard, balanced: true };
};
