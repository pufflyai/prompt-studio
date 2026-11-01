import { capabilityReply } from "./capability-reply";

export const frameDimensionChanged = (enabled: boolean, update: (size: number) => void) => (size: number) => {
  if (enabled && Number.isFinite(size) && size >= 0) update(size);
};

/** Old RPC listeners may outlive their frame. Admission belongs to its live browsing context. */
export const callFrameCapability = <T>(
  iframe: HTMLIFrameElement,
  current: HTMLIFrameElement | null,
  connectedWindow: Window | null,
  call: () => T,
) =>
  capabilityReply(() => {
    if (!iframe.isConnected || current !== iframe || iframe.contentWindow !== connectedWindow)
      throw Object.assign(new Error("This webview is no longer connected"), { code: "session_closed" });
    return call();
  });
