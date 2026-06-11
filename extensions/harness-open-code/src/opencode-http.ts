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
  url.searchParams.set("directory", directory);
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

  const cause = (error as { cause?: unknown }).cause;
  if (cause && typeof cause === "object") {
    const code = (cause as { code?: unknown }).code;
    if (code === "ECONNREFUSED" || code === "ECONNRESET" || code === "ENOTFOUND") return true;
  }

  return false;
};

export const requestJson = async <T>(
  fetcher: OpencodeFetcher,
  url: string,
  options: { method: string; headers: Record<string, string>; body?: unknown },
) => {
  const timeoutMs = options.method === "GET" ? GET_TIMEOUT_MS : POST_TIMEOUT_MS;

  const response = await fetcher(url, {
    method: options.method,
    headers: options.headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(timeoutMs),
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

export const parsePromptResponse = (text: string) => {
  const trimmed = text.trim();
  if (!trimmed) return;

  const parsed = parseJsonValue(trimmed);
  if (!parsed || typeof parsed !== "object") {
    throw new Error(`OpenCode session.prompt returned unexpected response: ${trimmed}`);
  }

  const record = parsed as Record<string, unknown>;

  if (record.info && record.parts) return;

  if (typeof record.name === "string") {
    const data = record.data as { message?: string } | undefined;
    const message = data?.message ?? trimmed;
    throw new Error(`OpenCode session.prompt failed: ${record.name}: ${message}`);
  }

  throw new Error(`OpenCode session.prompt returned unexpected response: ${trimmed}`);
};
