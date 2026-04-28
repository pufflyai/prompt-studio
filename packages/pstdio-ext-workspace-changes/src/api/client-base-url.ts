type RuntimeConfig = {
  apiBaseUrl?: string;
};

const readRuntimeConfig = () => {
  const global = globalThis as unknown as { __PSTDIO_CONFIG__?: RuntimeConfig };
  return global.__PSTDIO_CONFIG__ ?? null;
};

const readViteApiBaseUrl = () => {
  const meta = import.meta as unknown as { env?: { VITE_API_BASE_URL?: string } };
  return meta.env?.VITE_API_BASE_URL;
};

export const resolveApiBaseUrl = () => {
  const runtimeApiBaseUrl = readRuntimeConfig()?.apiBaseUrl;
  if (runtimeApiBaseUrl) return runtimeApiBaseUrl.replace(/\/$/, "");

  const envApiBaseUrl = readViteApiBaseUrl();
  if (envApiBaseUrl?.trim()) return envApiBaseUrl.trim().replace(/\/$/, "");

  return "http://localhost:19840";
};
