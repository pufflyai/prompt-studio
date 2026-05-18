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
  headers?: HeadersInit;
  cache?: RequestCache;
};

export type RequestFn = <T>(path: string, options?: RequestOptions) => Promise<T>;

type ZodIssue = { path?: unknown; message?: unknown };

const formatZodIssues = (issues: ZodIssue[]) =>
  issues
    .map((issue) => {
      const path = Array.isArray(issue.path) ? issue.path.filter((part) => part !== "").join(".") : "";
      const message = typeof issue.message === "string" ? issue.message : JSON.stringify(issue);
      return path ? `${path}: ${message}` : message;
    })
    .join("; ");

const stringifyErrorField = (error: unknown): string => {
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const issues = (error as { issues?: unknown }).issues;
    if (Array.isArray(issues)) return formatZodIssues(issues as ZodIssue[]);
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error);
};

const readErrorMessage = (errorBody: unknown, status: number) => {
  if (errorBody && typeof errorBody === "object" && errorBody !== null && "error" in errorBody) {
    const message = stringifyErrorField((errorBody as { error: unknown }).error);
    const hookOutput =
      "hook_output" in errorBody && typeof errorBody.hook_output === "string" ? errorBody.hook_output.trim() : "";

    return hookOutput ? `${message}\n${hookOutput}` : message;
  }

  return `Request failed: ${status}`;
};

export const resolveBaseUrl = (options: ClientOptions) =>
  options.baseUrl ??
  (typeof process !== "undefined" ? process.env.PSTDIO_API_URL : undefined) ??
  "http://localhost:19840";

export const resolveClientUrl = (baseUrl: string, path: string) =>
  path.startsWith("http://") || path.startsWith("https://") ? path : `${baseUrl}${path}`;

export const resolveFetch = (options: ClientOptions) => options.fetch ?? globalThis.fetch;

export const createRequestHeaders = (
  options: ClientOptions,
  reqOpts: { headers?: HeadersInit; hasJsonBody?: boolean } = {},
) => {
  const headers = new Headers(reqOpts.headers);
  if (reqOpts.hasJsonBody && !headers.has("content-type")) headers.set("content-type", "application/json");
  if (options.token) headers.set("authorization", `Bearer ${options.token}`);
  return headers;
};

export const createRequest = (options: ClientOptions): RequestFn => {
  const baseUrl = resolveBaseUrl(options);
  const fetchFn = resolveFetch(options);

  return async <T>(path: string, reqOpts: RequestOptions = {}): Promise<T> => {
    const headers = createRequestHeaders(options, {
      headers: reqOpts.headers,
      hasJsonBody: reqOpts.body !== undefined,
    });
    const url = resolveClientUrl(baseUrl, path);
    const response = await fetchFn(url, {
      method: reqOpts.method ?? "GET",
      headers: Object.fromEntries(headers.entries()),
      body: reqOpts.body !== undefined ? JSON.stringify(reqOpts.body) : undefined,
      signal: reqOpts.signal,
      cache: reqOpts.cache,
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
