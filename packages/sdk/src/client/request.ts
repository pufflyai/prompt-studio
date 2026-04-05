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
      const message =
        errorBody && typeof errorBody === "object" && errorBody !== null && "error" in errorBody
          ? String((errorBody as { error: string }).error)
          : `Request failed: ${response.status}`;
      throw new PstdioApiError(message, response.status);
    }

    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  };
};
