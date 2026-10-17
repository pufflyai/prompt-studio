import { createClient, type PstdioClient } from "@pstdio/sdk/client";
import { resolveApiUrl } from "./api-url";

const clients = new Map<string, PstdioClient>();

export const apiClient = () => {
  // Capture credentials with the connection. A retained client must not start using a
  // different runtime's token when CLI discovery changes the process environment.
  const options = { baseUrl: resolveApiUrl().replace(/\/$/, ""), token: process.env.PSTDIO_API_TOKEN ?? "" };
  const key = JSON.stringify(options);
  let client = clients.get(key);
  if (!client) {
    client = createClient(options);
    clients.set(key, client);
  }
  return client;
};

export const resetApiClient = () => {
  clients.clear();
};
