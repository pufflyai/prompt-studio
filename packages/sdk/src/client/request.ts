export type ClientOptions = {
  baseUrl?: string;
  token?: string;
  fetch?: typeof fetch;
};

export class PstdioApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "PstdioApiError";
    this.status = status;
  }
}

export type RequestOptions = {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
};

export type RequestFn = <T>(path: string, options?: RequestOptions) => Promise<T>;

const readErrorMessage = (errorBody: unknown, status: number) => {
  if (errorBody && typeof errorBody === "object" && errorBody !== null && "error" in errorBody) {
    const message = String((errorBody as { error: string }).error);
    const hookOutput =
      "hook_output" in errorBody && typeof errorBody.hook_output === "string" ? errorBody.hook_output.trim() : "";

    return hookOutput ? `${message}\n${hookOutput}` : message;
  }

  return `Request failed: ${status}`;
};

export const createRequest = (options: ClientOptions): RequestFn => {
  const baseUrl =
    options.baseUrl ??
    (typeof process !== "undefined" ? process.env.PSTDIO_API_URL : undefined) ??
    "http://localhost:19840";
  const fetchFn = options.fetch ?? globalThis.fetch;

  return async <T>(path: string, reqOpts: RequestOptions = {}): Promise<T> => {
    const headers: Record<string, string> = {};
    if (reqOpts.body !== undefined) headers["content-type"] = "application/json";
    if (options.token) headers.authorization = `Bearer ${options.token}`;

    const response = await fetchFn(`${baseUrl}${path}`, {
      method: reqOpts.method ?? "GET",
      headers,
      body: reqOpts.body !== undefined ? JSON.stringify(reqOpts.body) : undefined,
      signal: reqOpts.signal,
    });

    if (!response.ok) {
      const errorBody: unknown = await response.json().catch(() => null);
      const message = readErrorMessage(errorBody, response.status);
      throw new PstdioApiError(message, response.status);
    }

    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  };
};
