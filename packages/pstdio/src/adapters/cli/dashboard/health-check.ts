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
};

export const waitForHealthy = async (options: WaitOptions) => {
  const { url, intervalMs = 200, timeoutMs = 15_000, fetcher = fetch } = options;
  const deadline = performance.now() + timeoutMs;

  while (performance.now() < deadline) {
    if (await isHealthy(url, fetcher)) return;
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error(`Service at ${url} did not become healthy within ${timeoutMs}ms`);
};
