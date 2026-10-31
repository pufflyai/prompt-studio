import type { FrameRequest } from "./protocol";

export interface FrameBootstrap {
  scripts: Record<string, Blob>;
  styles: Blob[];
  entry: string;
}

let load: ((source: string) => Promise<FrameBootstrap>) | undefined;

/**
 * Code for a Canvas frame rendered inside this frame, such as UI Canvas's own canvases. Only frames
 * whose code calls this function use the bridge: UI Canvas's frame component still uses its own
 * loader, so its canvases show "Preview asset loader is unavailable" in a package build until UI
 * Canvas imports this function from `@pstdio/canvas`.
 */
export const frameBootstrap = (source: string) => {
  if (!load) return Promise.reject(new Error("Preview asset loader is unavailable"));
  return load(source);
};

// A nested frame asks the frame that hosts it for code; this frame forwards the request to its own
// host, so sandboxed frames keep their opaque origins.
export const createFrameAssetBridge = (
  send: (request: { type: "assets"; requestId: string; source: string }) => void,
) => {
  const pending = new Map<string, { resolve: (value: FrameBootstrap) => void; reject: (error: Error) => void }>();
  const loader = (source: string) =>
    new Promise<FrameBootstrap>((resolve, reject) => {
      const requestId = crypto.randomUUID();
      pending.set(requestId, { resolve, reject });
      send({ type: "assets", requestId, source });
    });
  load = loader;
  return {
    receive: (message: FrameRequest) => {
      const request = pending.get(message.requestId!);
      if (!request) return;
      pending.delete(message.requestId!);
      if (message.error) request.reject(new Error(message.error));
      else if (message.bootstrap) request.resolve(message.bootstrap);
    },
    dispose: () => {
      if (load === loader) load = undefined;
      for (const request of pending.values()) request.reject(new Error("Preview closed"));
      pending.clear();
    },
  };
};
