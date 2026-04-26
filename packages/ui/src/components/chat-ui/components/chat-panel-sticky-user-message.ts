import type { SessionMessage } from "./message-types";

export const STICKY_USER_MESSAGE_COLLAPSE_TEXT_THRESHOLD = 360;
export const STICKY_USER_MESSAGE_COLLAPSE_LINE_THRESHOLD = 4;
export const STICKY_USER_MESSAGE_COLLAPSED_MAX_HEIGHT = "min(10vh, 4rem)";
export const STICKY_USER_MESSAGE_EXPANDED_MAX_HEIGHT = "min(70dvh, calc(100dvh - 12rem), 22rem)";

const SCROLL_BOUNDARY_EPSILON = 1;

interface StickyUserMessageScrollElement {
  clientHeight: number;
  scrollHeight: number;
  scrollTop: number;
}

const getMessageTextMetrics = (message: SessionMessage) => {
  return message.parts.reduce(
    (metrics, part) => {
      if (part.type !== "text") return metrics;

      return {
        lineCount: metrics.lineCount + part.text.split(/\r\n|\r|\n/).length,
        textLength: metrics.textLength + part.text.length,
      };
    },
    { lineCount: 0, textLength: 0 },
  );
};

export const isStickyUserMessageCollapsible = (message: SessionMessage) => {
  if (message.role !== "user") return false;

  const { lineCount, textLength } = getMessageTextMetrics(message);

  return (
    textLength > STICKY_USER_MESSAGE_COLLAPSE_TEXT_THRESHOLD || lineCount > STICKY_USER_MESSAGE_COLLAPSE_LINE_THRESHOLD
  );
};

export const shouldStopStickyUserMessageWheel = (element: StickyUserMessageScrollElement, deltaY: number) => {
  const maxScrollTop = Math.max(0, element.scrollHeight - element.clientHeight);

  if (deltaY === 0 || maxScrollTop <= SCROLL_BOUNDARY_EPSILON) return false;
  if (deltaY < 0) return element.scrollTop > SCROLL_BOUNDARY_EPSILON;

  return element.scrollTop < maxScrollTop - SCROLL_BOUNDARY_EPSILON;
};
