import { createClient, type PstdioClient } from "@pstdio/sdk/client";
import { readBrowserSession } from "./browser-session";
import { resolveApiBaseUrl } from "./runtime-config";
import { getRuntimeCollections, type RuntimeCollections } from "./sync/collections";

export type { PstdioConfig } from "./runtime-config";
export { readRuntimeConfig } from "./runtime-config";

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

// The browser session secret is a bearer credential. A server without auth ignores it.
export const apiClientOptions = () => ({ baseUrl: resolveApiBaseUrl(), token: readBrowserSession() ?? "" });

const runtimeClients = new WeakMap<RuntimeCollections, PstdioClient>();

/** The runtime's client owns its shared resource transport for the whole connection lifetime. */
export const getRuntimeApiClient = (owner: RuntimeCollections) => {
  if (owner.isDisposed()) throw new Error("Runtime is disposed");
  let client = runtimeClients.get(owner);
  if (!client) {
    client = createClient(owner.connection);
    runtimeClients.set(owner, client);
    owner.onDispose(() => runtimeClients.delete(owner));
  }
  return client;
};

export const getApiClient = (options = apiClientOptions()) => getRuntimeApiClient(getRuntimeCollections(options));
