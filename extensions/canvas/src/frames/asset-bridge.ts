import type { FrameBootstrap } from "./asset-loader";
import type { FrameRequest } from "./protocol";

// Nested Canvas examples ask their owning viewer for immutable code, keeping opaque origins intact.
export const createFrameAssetBridge = (
  send: (request: { type: "assets"; requestId: string; source: string }) => void,
) => {
  const pending = new Map<string, { resolve: (value: FrameBootstrap) => void; reject: (error: Error) => void }>();
  return {
    load: (source: string) =>
      new Promise<FrameBootstrap>((resolve, reject) => {
        const requestId = crypto.randomUUID();
        pending.set(requestId, { resolve, reject });
        send({ type: "assets", requestId, source });
      }),
    receive: (message: FrameRequest) => {
      const request = pending.get(message.requestId!);
      if (!request) return;
      pending.delete(message.requestId!);
      if (message.error) request.reject(new Error(message.error));
      else if (message.bootstrap) request.resolve(message.bootstrap);
    },
    dispose: () => {
      for (const request of pending.values()) request.reject(new Error("Preview closed"));
      pending.clear();
    },
  };
};
