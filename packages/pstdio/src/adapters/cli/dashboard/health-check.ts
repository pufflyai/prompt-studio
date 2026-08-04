type Fetcher = (url: string) => Promise<{ ok: boolean }>;

export const isHealthy = async (url: string, fetcher: Fetcher = fetch) => {
  try {
    const response = await fetcher(url);
    return response.ok;
  } catch {
    return false;
  }
};

type WaitOptions = {
  url: string;
  intervalMs?: number;
  timeoutMs?: number;
  fetcher?: Fetcher;
  signal?: AbortSignal;
};

const waitForRetry = (intervalMs: number, signal: AbortSignal | undefined) =>
  new Promise<void>((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }

    const onAbort = () => {
      clearTimeout(timeout);
      resolve();
    };
    const timeout = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, intervalMs);
    signal?.addEventListener("abort", onAbort, { once: true });
  });

export const waitForHealthy = async (options: WaitOptions) => {
  const { url, intervalMs = 200, timeoutMs = 15_000, fetcher = fetch, signal } = options;
  const deadline = performance.now() + timeoutMs;

  while (performance.now() < deadline) {
    signal?.throwIfAborted();
    if (await isHealthy(url, fetcher)) return;
    signal?.throwIfAborted();
    await waitForRetry(intervalMs, signal);
  }

  signal?.throwIfAborted();
  throw new Error(`Service at ${url} did not become healthy within ${timeoutMs}ms`);
};
