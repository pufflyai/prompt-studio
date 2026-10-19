// Entries for devices whose bucket refilled are dropped once the map grows this large.
const pruneAt = 10_000;

/** Per-device token buckets for requests and live messages (R28). */
export const createRateLimit = (perSecond: number, burst: number, now = () => Date.now()) => {
  const buckets = new Map<string, { tokens: number; at: number }>();
  const refill = (bucket: { tokens: number; at: number }, time: number) =>
    Math.min(burst, bucket.tokens + ((time - bucket.at) / 1000) * perSecond);
  return (key: string) => {
    const time = now();
    if (buckets.size >= pruneAt)
      for (const [entry, bucket] of buckets) if (refill(bucket, time) >= burst) buckets.delete(entry);
    const previous = buckets.get(key);
    const tokens = previous ? refill(previous, time) : burst;
    const allowed = tokens >= 1;
    buckets.set(key, { tokens: allowed ? tokens - 1 : tokens, at: time });
    return allowed;
  };
};
export type RateLimit = ReturnType<typeof createRateLimit>;
