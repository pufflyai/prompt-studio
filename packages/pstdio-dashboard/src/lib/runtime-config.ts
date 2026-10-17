export type PstdioConfig = {
  apiBaseUrl?: string;
  terminalWebSocketUrl?: string;
  version?: string;
};

export const readRuntimeConfig = (): PstdioConfig | null => {
  const w = globalThis as unknown as { __PSTDIO_CONFIG__?: PstdioConfig };
  if (w.__PSTDIO_CONFIG__) return w.__PSTDIO_CONFIG__;

  const encodedConfig = globalThis.document?.querySelector<HTMLMetaElement>('meta[name="pstdio-config"]')?.content;
  if (!encodedConfig) return null;
  try {
    return JSON.parse(decodeURIComponent(encodedConfig)) as PstdioConfig;
  } catch {
    return null;
  }
};

export const resolveApiBaseUrl = () => {
  const runtimeConfig = readRuntimeConfig();

  if (runtimeConfig) {
    return runtimeConfig.apiBaseUrl?.replace(/\/$/, "") ?? "";
  }

  // Packaged dashboards share an origin with the API. Vite development uses its proxy.
  return "";
};
