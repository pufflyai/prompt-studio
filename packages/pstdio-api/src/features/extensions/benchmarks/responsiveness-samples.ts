export interface WorkWindow {
  startedAt: number;
  endedAt: number;
}
export interface ProbeSample extends WorkWindow {
  ok: boolean;
  status: number;
  error?: string;
}

export const summarizeProbeSamples = (samples: ProbeSample[], window: WorkWindow) => {
  // Retain responses finishing after work. Dropping those would hide inline stalls.
  const selected = samples.filter((sample) => sample.endedAt >= window.startedAt && sample.startedAt < window.endedAt);
  const latencies = selected.map((sample) => sample.endedAt - sample.startedAt).sort((a, b) => a - b);
  return {
    count: selected.length,
    errors: selected.filter((sample) => !sample.ok).length,
    completedDuringWork: selected.filter((sample) => sample.ok && sample.endedAt <= window.endedAt).length,
    p95Ms: latencies.length ? latencies[Math.ceil(latencies.length * 0.95) - 1]! : null,
    maxMs: latencies.length ? latencies[latencies.length - 1]! : null,
  };
};

export const probeDuring = async <T>(operations: Record<string, () => Promise<Response>>, work: () => Promise<T>) => {
  let running = true;
  const samples: Record<string, ProbeSample[]> = {};
  const startedAt = performance.timeOrigin + performance.now();
  const probes = Object.entries(operations).map(async ([name, request]) => {
    const recorded: ProbeSample[] = [];
    samples[name] = recorded;
    while (running) {
      const sample: ProbeSample = {
        startedAt: performance.timeOrigin + performance.now(),
        endedAt: 0,
        ok: false,
        status: 0,
      };
      try {
        const response = await request();
        sample.status = response.status;
        const body = (await response.json()) as { outcome?: { ok?: boolean } };
        sample.ok = response.ok && body?.outcome?.ok !== false;
      } catch (error) {
        sample.error = error instanceof Error ? error.name : "UnknownError";
      }
      sample.endedAt = performance.timeOrigin + performance.now();
      recorded.push(sample);
      if (running) await Bun.sleep(20);
    }
  });
  try {
    const value = await work();
    const endedAt = performance.timeOrigin + performance.now();
    running = false;
    await Promise.all(probes);
    const window = { startedAt, endedAt };
    return { value, window, samples, probes: summarizeProbes(samples, window) };
  } finally {
    running = false;
    await Promise.all(probes);
  }
};

export const summarizeProbes = (samples: Record<string, ProbeSample[]>, window: WorkWindow) =>
  Object.fromEntries(
    Object.entries(samples).map(([name, recorded]) => [name, summarizeProbeSamples(recorded, window)]),
  );
