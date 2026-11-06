export type OpencodeFetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const GET_TIMEOUT_MS = 15_000;
const POST_TIMEOUT_MS = 300_000;

export const parseJsonValue = (value: string) => {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
};

export const buildRequestUrl = (baseUrl: string, path: string, directory: string) => {
  const url = new URL(path, baseUrl);
  url.searchParams.set("location[directory]", directory);
  return url.toString();
};

export const buildHeaders = (directory: string) => ({
  "content-type": "application/json",
  "x-opencode-directory": directory,
});

export const isTransportTimeout = (error: unknown) =>
  error instanceof DOMException && (error.name === "AbortError" || error.name === "TimeoutError");

// True when the error looks like the cached server URL is unreachable
// (connection refused, DNS failure, socket reset). These are safe to retry
// after rediscovering the server. Transport timeouts and HTTP-level errors
// are NOT connection errors — retrying them risks duplicating non-idempotent
// POSTs that may already be in flight on the server.
export const isConnectionError = (error: unknown) => {
  if (isTransportTimeout(error)) return false;
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();
  if (message.includes("fetch failed")) return true;
  if (message.includes("econnrefused")) return true;
  if (message.includes("econnreset")) return true;

  const cause = (error as { cause?: { code?: unknown } }).cause;
  const code = (error as { code?: unknown }).code ?? cause?.code;
  return code === "ECONNREFUSED" || code === "ECONNRESET" || code === "ENOTFOUND" || code === "ConnectionRefused";
};

export const requestJson = async <T>(
  fetcher: OpencodeFetcher,
  url: string,
  options: { method: string; headers: Record<string, string>; body?: unknown; signal?: AbortSignal },
) => {
  options.signal?.throwIfAborted();
  const timeoutMs = options.method === "GET" ? GET_TIMEOUT_MS : POST_TIMEOUT_MS;
  const endpoint = new URL(url);
  const headers = { ...options.headers };
  if (endpoint.password) {
    headers.authorization = `Basic ${Buffer.from(`${decodeURIComponent(endpoint.username)}:${decodeURIComponent(endpoint.password)}`).toString("base64")}`;
    endpoint.username = "";
    endpoint.password = "";
  }

  const response = await fetcher(endpoint.href, {
    method: options.method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: options.signal
      ? AbortSignal.any([options.signal, AbortSignal.timeout(timeoutMs)])
      : AbortSignal.timeout(timeoutMs),
  });

  const text = await response.text();
  const parsed = text.trim() ? (parseJsonValue(text) as T | null) : null;

  return { response, text, parsed };
};

export const requireResponseOk = (response: Response, text: string, message: string) => {
  if (response.ok) return;

  const suffix = text.trim() ? ` ${text.trim()}` : "";
  throw new Error(`${message}: HTTP ${response.status}${suffix}`);
};
