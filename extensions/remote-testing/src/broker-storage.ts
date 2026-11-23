import type { ExtensionConnectionsApi } from "@pstdio/sdk/extensions";
import { canRetryControllerRequest, connectionApi, storageConnection, waitForControllerPoll } from "./connection";
import type { RunStorage } from "./storage";

export function brokerStorage(connections: ExtensionConnectionsApi): RunStorage {
  const api = connectionApi(connections, storageConnection.id);
  const signedUrl = async (method: "GET" | "PUT", object: string, expiresSeconds: number) => {
    const result = await api<{ url: string }>({
      method: "POST",
      path: "/v1/storage/url",
      body: { method, object, expiresSeconds },
    });
    if (new URL(result.url).protocol !== "https:") throw new Error("Cloud storage returned an invalid URL.");
    return result.url;
  };
  return {
    signedUrl,
    async upload(object, archive) {
      const response = await fetch(await signedUrl("PUT", object, 1800), {
        method: "PUT",
        body: archive,
        redirect: "error",
        signal: AbortSignal.timeout(120_000),
      });
      if (!response.ok) throw new Error(`Cloud source upload failed (HTTP ${response.status}).`);
    },
    async download(object, options) {
      while (true) {
        options?.signal?.throwIfAborted();
        try {
          const response = await fetch(await signedUrl("GET", object, 300), {
            redirect: "error",
            signal: options?.signal ?? AbortSignal.timeout(120_000),
          });
          if (response.status === 404) return null;
          if (!response.ok)
            throw Object.assign(new Error(`Cloud log download failed (HTTP ${response.status}).`), {
              status: response.status,
            });
          return new Uint8Array(await response.arrayBuffer());
        } catch (error) {
          options?.signal?.throwIfAborted();
          if (!options?.retryTransient || !canRetryControllerRequest(error)) throw error;
          await waitForControllerPoll(options?.signal);
        }
      }
    },
  };
}
