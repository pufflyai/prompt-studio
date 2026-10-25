const describeRefusal = async (response: Response) => {
  const body = await response.text();
  let message = body;
  try {
    message = (JSON.parse(body) as { message?: string }).message ?? body;
  } catch {}
  const error = new Error(
    `CI results API: HTTP ${response.status}: ${message.slice(0, 500)}; ` +
      `remaining=${response.headers.get("x-ratelimit-remaining") ?? "unknown"}; ` +
      `reset=${response.headers.get("x-ratelimit-reset") ?? "unknown"}; ` +
      `retry-after=${response.headers.get("retry-after") ?? "unknown"}`,
  );
  const retryAfter = Number(response.headers.get("retry-after"));
  const reset = Number(response.headers.get("x-ratelimit-reset"));
  let until = 0;
  if (retryAfter > 0) until = Date.now() + retryAfter * 1000;
  else if (response.headers.get("x-ratelimit-remaining") === "0" && reset > 0) until = reset * 1000;
  else if (response.status === 429 || /secondary rate limit/i.test(message)) until = Date.now() + 60_000;
  return { error, until };
};

export const createCiResultsClient = (token: string) => {
  const cache = new Map<string, { etag: string; body: unknown }>();
  let paused: { until: number; error: Error } | undefined;
  return async (url: string) => {
    if (paused && Date.now() < paused.until) throw paused.error;
    paused = undefined;
    const cached = cache.get(url);
    const response = await fetch(url, {
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/vnd.github+json",
        ...(cached ? { "if-none-match": cached.etag } : {}),
      },
      signal: AbortSignal.timeout(10000),
    });
    // Authenticated 304 responses do not spend GitHub's primary API quota.
    if (response.status === 304 && cached) return cached.body;
    if (!response.ok) {
      paused = await describeRefusal(response);
      throw paused.error;
    }
    const body: unknown = await response.json();
    const etag = response.headers.get("etag");
    if (etag) cache.set(url, { etag, body });
    else cache.delete(url);
    return body;
  };
};
