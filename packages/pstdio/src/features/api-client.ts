import { createClient, type PstdioClient } from "@pstdio/sdk/client";
import { resolveApiUrl } from "./api-url";

let instance: PstdioClient | null = null;

export const apiClient = () => {
  if (!instance) {
    instance = createClient({ baseUrl: resolveApiUrl() });
  }
  return instance;
};

export const resetApiClient = () => {
  instance = null;
};
