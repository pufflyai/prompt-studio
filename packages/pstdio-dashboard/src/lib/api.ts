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
  if (w.__PSTDIO_CONFIG__) return w.__PSTDIO_CONFIG__;

  const encodedConfig = globalThis.document?.querySelector<HTMLMetaElement>('meta[name="pstdio-config"]')?.content;
  return encodedConfig ? (JSON.parse(decodeURIComponent(encodedConfig)) as PstdioConfig) : null;
};

const resolveApiBaseUrl = () => {
  const runtimeConfig = readRuntimeConfig();

  if (runtimeConfig) {
    return runtimeConfig.apiBaseUrl?.replace(/\/$/, "") ?? "";
  }

  // Packaged dashboards share an origin with the API. Vite development uses its proxy.
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

const tryBuildAbsoluteUrl = (path: string, baseHref: string | undefined) => {
  if (!baseHref) return null;
  try {
    return new URL(path, baseHref).toString();
  } catch {
    return null;
  }
};

const getAbsoluteApiBaseCandidates = (baseHref: string | undefined) => [
  baseHref,
  globalThis.document?.baseURI,
  globalThis.document?.referrer,
  globalThis.location?.origin && globalThis.location.origin !== "null" ? `${globalThis.location.origin}/` : undefined,
  "http://localhost/",
];

export const buildAbsoluteApiUrl = (path: string, baseHref = globalThis.location?.href) => {
  const apiUrl = buildApiUrl(path);
  if (apiUrl.startsWith("http://") || apiUrl.startsWith("https://")) return apiUrl;

  for (const candidate of getAbsoluteApiBaseCandidates(baseHref)) {
    const absoluteUrl = tryBuildAbsoluteUrl(apiUrl, candidate);
    if (absoluteUrl) return absoluteUrl;
  }

  return apiUrl;
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
