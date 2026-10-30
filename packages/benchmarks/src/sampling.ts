export const parseSampleCount = (value: string | number) => {
  const count = Number(value);
  if (!Number.isSafeInteger(count) || count < 1) throw new Error("BENCHMARK_SAMPLES must be a positive integer");
  return count;
};

export const benchmarkSampleCount = (fallback = 1) => parseSampleCount(process.env.BENCHMARK_SAMPLES ?? fallback);

export const benchmarkSampleIndex = () => Number(process.env.BENCHMARK_SAMPLE_INDEX ?? "0");
