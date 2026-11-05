/** Overlap the previous receiver's download with local staging, then drain every admitted witness. */
export const withCloudReplacementWitness = async (
  run: (witness: { start: (work: () => Promise<void>) => void; wait: () => Promise<void> }) => Promise<void>,
) => {
  let pending: Promise<PromiseSettledResult<void>[]> | undefined;
  const wait = async () => {
    const current = pending;
    pending = undefined;
    if (!current) return;
    const result = (await current)[0]!;
    if (result.status === "rejected") throw result.reason;
  };
  const start = (work: () => Promise<void>) => {
    if (pending) throw new Error("The previous replacement witness must be drained before another starts");
    pending = Promise.allSettled([Promise.resolve().then(work)]);
  };
  const failures: unknown[] = [];
  try {
    await run({ start, wait });
  } catch (error) {
    failures.push(error);
  } finally {
    const results = await Promise.allSettled([wait()]);
    failures.push(...results.flatMap((result) => (result.status === "rejected" ? [result.reason] : [])));
  }
  if (failures.length) throw new AggregateError(failures, "Cloud replacement staging or witness failed");
};
