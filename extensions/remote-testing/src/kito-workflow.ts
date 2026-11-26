import type { Api } from "./connection";
import { canRetryControllerRequest, PocketCoderError, waitForControllerPoll } from "./connection";
import type { RunStorage } from "./storage";

export const kitoWorkflowPath = "/v1/kito-workflow";

function signedStorage(api: Api, method: "GET" | "PUT", object: string, seconds: number, signal?: AbortSignal) {
  const source = object.match(/^sources\/([0-9a-f-]{36})\.tar\.gz$/);
  const log = object.match(/^logs\/([0-9a-f-]{36})\.log$/);
  const runId = source?.[1] ?? log?.[1];
  if (!runId) throw new Error("Expected a run source or log object.");
  const action = (method === "GET" ? "read" : "upload") + (source ? "-source" : "-log");
  return api<{ url: string }>({
    method: "POST",
    path: `${kitoWorkflowPath}/storage/urls`,
    body: { action, runId, seconds },
    signal,
  }).then(({ url }) => {
    const target = new URL(url);
    if (target.origin !== "https://storage.googleapis.com" || target.username || target.password)
      throw new Error("Kito returned an invalid Cloud Storage URL.");
    return target.href;
  });
}

export function kitoStorage(api: Api, request = fetch): RunStorage {
  return {
    async upload(object, archive) {
      const url = await signedStorage(api, "PUT", object, 300);
      const response = await request(url, { method: "PUT", body: archive, redirect: "error" });
      if (!response.ok) throw new Error(`Kito source upload returned HTTP ${response.status}.`);
    },
    async download(object, options) {
      const signal = options?.signal;
      for (;;) {
        signal?.throwIfAborted();
        try {
          const url = await signedStorage(api, "GET", object, 300, signal);
          const response = await request(url, { signal, redirect: "error" });
          if (response.status === 404) return null;
          if (!response.ok) throw new PocketCoderError(response.status, "Kito log download failed.");
          return new Uint8Array(await response.arrayBuffer());
        } catch (error) {
          signal?.throwIfAborted();
          if (!options?.retryTransient || !canRetryControllerRequest(error)) throw error;
        }
        await waitForControllerPoll(signal);
      }
    },
    signedUrl: (method, object, seconds) => signedStorage(api, method, object, seconds),
  };
}

export async function openKitoPreview(api: Api, workspaceId: string, signal?: AbortSignal) {
  const deadline = Date.now() + 30 * 60_000;
  while (true) {
    try {
      const preview = await api<{ workspaceId: string; url: string; expiresAt: string }>({
        method: "POST",
        path: `${kitoWorkflowPath}/previews/${encodeURIComponent(workspaceId)}`,
        timeoutMs: 60_000,
        signal,
      });
      const url = new URL(preview.url);
      if (
        url.protocol !== "https:" ||
        url.username ||
        url.password ||
        !Number.isFinite(Date.parse(preview.expiresAt)) ||
        Date.parse(preview.expiresAt) <= Date.now()
      )
        throw new Error("Kito returned an invalid preview URL or expiry.");
      if (preview.workspaceId !== workspaceId) throw new Error("Kito returned a different preview workspace.");
      return preview;
    } catch (error) {
      if (!(error instanceof PocketCoderError) || error.status !== 425 || Date.now() >= deadline) throw error;
    }
    await waitForControllerPoll(signal);
  }
}
