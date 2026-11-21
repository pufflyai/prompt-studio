export interface TransferOptions {
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  // Total time one request may spend waiting out rate limits and server errors.
  maxWaitMs?: number;
  // A stalled connection fails after this long without a response or a body chunk.
  idleTimeoutMs?: number;
}

export const attempts = 5;

// A dropped or stalled transfer; a fresh request can succeed.
export class TransientTransferError extends Error {}

export const pause = (options: TransferOptions, ms: number) =>
  (options.sleep ?? ((wait) => new Promise<void>((done) => setTimeout(done, wait))))(ms);

// Mirrors scripts/ci/ci-results-client.ts: wait out GitHub's load and quota refusals, but fail
// fast on other refusals such as a token without actions:read.
const retryDelay = async (response: Response, attempt: number, now: number) => {
  if (response.status >= 500) return 2000 * attempt;
  if (response.status !== 403 && response.status !== 429) return;
  const retryAfter = Number(response.headers.get("retry-after"));
  const reset = Number(response.headers.get("x-ratelimit-reset"));
  if (retryAfter > 0) return retryAfter * 1000;
  if (response.headers.get("x-ratelimit-remaining") === "0" && reset > 0) return Math.max(reset * 1000 - now, 0);
  if (response.status === 429 || /secondary rate limit/i.test(await response.clone().text())) return 60_000;
};

const fetchWithIdleTimeout = async (options: TransferOptions, url: string, init: RequestInit) => {
  const idle = options.idleTimeoutMs ?? 30_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), idle);
  try {
    return await (options.fetch ?? fetch)(url, { ...init, signal: controller.signal });
  } catch (error) {
    throw new TransientTransferError(`${url.split("?")[0]}: ${error instanceof Error ? error.message : error}`);
  } finally {
    clearTimeout(timer);
  }
};

export const request = async (options: TransferOptions, url: string, init: RequestInit) => {
  const now = options.now ?? Date.now;
  const deadline = now() + (options.maxWaitMs ?? 600_000);
  for (let attempt = 1; ; attempt++) {
    const response = await fetchWithIdleTimeout(options, url, init);
    const delay = await retryDelay(response, attempt, now());
    if (delay === undefined || attempt === attempts || now() + delay > deadline) return response;
    await pause(options, delay);
  }
};

export const readBody = async (options: TransferOptions, response: Response) => {
  const idle = options.idleTimeoutMs ?? 30_000;
  const reader = response.body?.getReader();
  const chunks: Uint8Array[] = [];
  while (reader) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stalled = new Promise<never>((_, fail) => {
      timer = setTimeout(() => fail(new TransientTransferError(`The download stalled for ${idle} ms`)), idle);
    });
    try {
      const chunk = await Promise.race([reader.read(), stalled]);
      if (chunk.done) break;
      chunks.push(chunk.value);
    } catch (error) {
      reader.cancel().catch(() => {});
      if (error instanceof TransientTransferError) throw error;
      throw new TransientTransferError(
        `The download was interrupted: ${error instanceof Error ? error.message : error}`,
      );
    } finally {
      clearTimeout(timer);
    }
  }
  return Buffer.concat(chunks);
};
