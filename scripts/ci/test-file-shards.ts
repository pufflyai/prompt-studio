interface ShardOptions {
  shard?: string;
  timings?: Record<string, number>;
}
const normalize = (path: string) => path.replaceAll("\\", "/").replace(/^\.\//, "");
// Shared with the API file pool: preserve its deterministic round-robin fallback,
// longest-first assignment, median estimate and stable tie breaking.
export const shardTestFiles = (files: string[], options: ShardOptions = {}) => {
  const selected = [...files].sort();
  const shard = options.shard ?? "1/1";
  if (!/^[1-9]\d*\/[1-9]\d*$/.test(shard)) throw new Error(`Invalid test shard: ${shard}`);
  const [index, count] = shard.split("/").map(Number) as [number, number];
  if (index > count) throw new Error(`Invalid test shard: ${shard}`);
  const timings = Object.fromEntries(
    Object.entries(options.timings ?? {}).map(([file, duration]) => [normalize(file), duration]),
  );
  for (const file of selected) {
    if (timings[file] !== undefined && (!Number.isFinite(timings[file]) || timings[file]! < 0)) {
      throw new Error(`Invalid test duration for ${file}`);
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
