import type { WebviewPointerEvent } from "../contract";

/** Host outside-interaction layers receive the source iframe as their target. */
export const dispatchFramePointerEvent = (iframe: HTMLIFrameElement, event: WebviewPointerEvent) => {
  if (!iframe.isConnected || (event.type !== "pointerdown" && event.type !== "click")) return;
  const bounds = iframe.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return;
  iframe.dispatchEvent(
    new PointerEvent(event.type, {
      ...event,
      bubbles: true,
      composed: true,
      cancelable: true,
      clientX: bounds.left + event.clientX * (bounds.width / iframe.clientWidth),
      clientY: bounds.top + event.clientY * (bounds.height / iframe.clientHeight),
    }),
  );
};
