import { createClient, type PstdioClient } from "@pstdio/sdk/client";

let instance: PstdioClient | null = null;

export const apiClient = () => {
  if (!instance) {
    instance = createClient({
      baseUrl: process.env.PSTDIO_API_URL ?? "http://localhost:19840",
    });
  }
  return instance;
};

export const resetApiClient = () => {
  instance = null;
};
