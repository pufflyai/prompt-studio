// GitHub's own load or quota refusals say nothing about the observed jobs, so callers wait them out.
export class TemporaryCiResultsError extends Error {}

const describeRefusal = async (response: Response, now: number) => {
  const body = await response.text();
  let message = body;
  try {
    message = (JSON.parse(body) as { message?: string }).message ?? body;
  } catch {}
  const retryAfter = Number(response.headers.get("retry-after"));
  const reset = Number(response.headers.get("x-ratelimit-reset"));
  let until = 0;
  if (retryAfter > 0) until = now + retryAfter * 1000;
  else if (response.headers.get("x-ratelimit-remaining") === "0" && reset > 0) until = reset * 1000;
  else if (response.status === 429 || /secondary rate limit/i.test(message)) until = now + 60_000;
  const Refusal = until > 0 || response.status >= 500 ? TemporaryCiResultsError : Error;
  const error = new Refusal(
    `CI results API: HTTP ${response.status}: ${message.slice(0, 500)}; ` +
      `remaining=${response.headers.get("x-ratelimit-remaining") ?? "unknown"}; ` +
      `reset=${response.headers.get("x-ratelimit-reset") ?? "unknown"}; ` +
      `retry-after=${response.headers.get("retry-after") ?? "unknown"}`,
  );
  return { error, until };
};

export const createCiResultsClient = (token: string, now = Date.now) => {
  const cache = new Map<string, { etag: string; body: unknown }>();
  let paused: { until: number; error: Error } | undefined;
  return async (url: string) => {
    if (paused && now() < paused.until) throw paused.error;
    paused = undefined;
    const cached = cache.get(url);
    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          authorization: `Bearer ${token}`,
          accept: "application/vnd.github+json",
          ...(cached ? { "if-none-match": cached.etag } : {}),
        },
        signal: AbortSignal.timeout(10000),
      });
    } catch (error) {
      throw new TemporaryCiResultsError(`CI results API unavailable: ${String(error)}`);
    }
    // Authenticated 304 responses do not spend GitHub's primary API quota.
    if (response.status === 304 && cached) return cached.body;
    if (!response.ok) {
      paused = await describeRefusal(response, now());
      throw paused.error;
    }
    const body: unknown = await response.json();
    const etag = response.headers.get("etag");
    if (etag) cache.set(url, { etag, body });
    else cache.delete(url);
    return body;
  };
};
