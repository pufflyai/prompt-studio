import { sizesToContentHeight, type WebviewSizing } from "../contract";
import { capabilityReply } from "./capability-reply";

export const frameDimensionChanged =
  (enabled: boolean | (() => boolean), update: (size: number) => void, visible: () => boolean) => (size: number) => {
    const active = typeof enabled === "function" ? enabled() : enabled;
    if (active && Number.isFinite(size) && size >= 0 && (size > 0 || visible())) update(size);
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

export const frameSizeCallbacks = (
  sizing: { current: WebviewSizing | undefined },
  height: (size: number) => void,
  width: (size: number) => void,
  visible: { current: boolean },
) => ({
  contentHeightChanged: frameDimensionChanged(
    () => sizesToContentHeight(sizing.current),
    height,
    () => visible.current,
  ),
  contentWidthChanged: frameDimensionChanged(
    () => sizing.current === "content-width",
    width,
    () => visible.current,
  ),
});
