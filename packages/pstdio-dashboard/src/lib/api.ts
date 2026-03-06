type ApiRequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  allowNotFound?: boolean;
};

export type PstdioConfig = {
  apiBaseUrl?: string;
  version?: string;
};

export const readRuntimeConfig = (): PstdioConfig | null => {
  const w = globalThis as unknown as { __PSTDIO_CONFIG__?: PstdioConfig };
  return w.__PSTDIO_CONFIG__ ?? null;
};

const resolveApiBaseUrl = () => {
  const runtimeConfig = readRuntimeConfig();

  if (runtimeConfig?.apiBaseUrl) {
    return runtimeConfig.apiBaseUrl.replace(/\/$/, "");
  }

  const envBaseUrl = import.meta.env?.VITE_API_BASE_URL;

  if (envBaseUrl && envBaseUrl.trim().length > 0) {
    return envBaseUrl.trim().replace(/\/$/, "");
  }

  return "http://localhost:3000";
};

export const buildApiUrl = (path: string) => {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  const baseUrl = resolveApiBaseUrl();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${baseUrl}${normalizedPath}`;
};

export const apiRequest = async <T>(path: string, options: ApiRequestOptions = {}) => {
  const { body, headers, allowNotFound, ...rest } = options;
  const resolvedHeaders = new Headers(headers);

  if (body !== undefined && !resolvedHeaders.has("content-type")) {
    resolvedHeaders.set("content-type", "application/json");
  }

  const response = await fetch(buildApiUrl(path), {
    ...rest,
    headers: resolvedHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (response.status === 204) {
    return undefined as T;
  }

  if (response.status === 404 && allowNotFound) {
    return null as T;
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    const message =
      errorBody && typeof errorBody === "object" && "error" in errorBody ? String(errorBody.error) : "Request failed";
    throw new Error(message);
  }

  return (await response.json()) as T;
};
