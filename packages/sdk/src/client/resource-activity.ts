import type { PublishResourceActivity, ResourceActivityApi, ResourceActivityEntry, ResourceRef } from "../extensions";
import type { RequestFn } from "./request";
import type { createSessionStreamTransport } from "./session-stream";

export interface ResourceActivityClient extends ResourceActivityApi {
  publish(
    resource: ResourceRef,
    entry: PublishResourceActivity,
    options?: { sourceSessionId?: string },
  ): Promise<ResourceActivityEntry>;
  /** Observe invalidations over the client's existing shared stream. */
  watch(resource: ResourceRef, input: { signal: AbortSignal; onChange(): void; onReady?(): void }): Promise<void>;
}
const encode = (bytes: Uint8Array) => {
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text);
};
export const createResourceActivityClient = (
  request: RequestFn,
  transport: ReturnType<typeof createSessionStreamTransport>,
): ResourceActivityClient => {
  const post = <T>(resource: ResourceRef, operation: string, body: object = {}) => {
    if (!resource.projectId) throw new Error("Activity requires a project ID.");
    return request<T>(`/v1/projects/${encodeURIComponent(resource.projectId)}/activity/${operation}`, {
      method: "POST",
      body: { resource, ...body },
    });
  };
  return {
    capabilities: (resource) => post(resource, "capabilities"),
    query: ({ resource, ...options }) => post(resource, "query", options),
    get: (resource, id) => post(resource, "get", { id }),
    publish: (resource, entry: PublishResourceActivity, options) => post(resource, "publish", { entry, ...options }),
    resolve: (resource, id, resolved) => post(resource, "resolve", { id, resolved }),
    handoff: (resource, id, options) => post<ResourceActivityEntry>(resource, "handoff", { id, ...options }),
    attach: (resource, file) =>
      post(resource, "attach", { key: file.key, name: file.name, mimeType: file.mimeType, base64: encode(file.data) }),
    readAttachment: async (resource, id) => {
      const result = await post<{ attachment: Awaited<ReturnType<ResourceActivityApi["attach"]>>; base64: string }>(
        resource,
        "attachment",
        { id },
      );
      return {
        attachment: result.attachment,
        data: Uint8Array.from(atob(result.base64), (char) => char.charCodeAt(0)),
      };
    },
    watch: (resource, input) =>
      new Promise<void>((resolve, reject) => {
        if (input.signal.aborted) return resolve();
        let subscription: { close(): void } | undefined;
        const cleanup = () => {
          input.signal.removeEventListener("abort", close);
          subscription?.close();
        };
        const close = () => {
          cleanup();
          resolve();
        };
        input.signal.addEventListener("abort", close, { once: true });
        subscription = transport.subscribe(
          { resource_activity: { project_id: resource.projectId!, resource } },
          {
            onEvent: (event) => {
              if (input.signal.aborted) return;
              if (event === "activity_ready") input.onReady?.();
              else if (event === "activity_changed") input.onChange();
              else if (event === "end") close();
            },
            onError: (error) => {
              cleanup();
              reject(error);
            },
          },
        );
        if (input.signal.aborted) subscription.close();
      }),
  };
};
