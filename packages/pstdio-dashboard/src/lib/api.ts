import { createClient, createRequest, PstdioApiError, type PstdioClient } from "@pstdio/sdk/client";

type ApiRequestOptions = {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
  headers?: HeadersInit;
  cache?: RequestCache;
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

  return "";
};

export const buildApiUrl = (path: string) => {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  const baseUrl = resolveApiBaseUrl();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${baseUrl}${normalizedPath}`;
};

let apiClientInstance: PstdioClient | null = null;
let apiClientBaseUrl: string | null = null;

export const getApiClient = () => {
  const baseUrl = resolveApiBaseUrl();
  if (!apiClientInstance || apiClientBaseUrl !== baseUrl) {
    apiClientInstance = createClient({ baseUrl });
    apiClientBaseUrl = baseUrl;
  }

  return apiClientInstance;
};

export const apiRequest = async <T>(path: string, options: ApiRequestOptions = {}) => {
  const { allowNotFound, ...requestOptions } = options;
  const request = createRequest({ baseUrl: resolveApiBaseUrl() });

  try {
    return await request<T>(path, requestOptions);
  } catch (error) {
    if (allowNotFound && error instanceof PstdioApiError && error.status === 404) {
      return null as T;
    }

    throw error;
  }
};
