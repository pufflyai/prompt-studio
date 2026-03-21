import type { SessionMessage } from "./message-types";

export const STICKY_USER_MESSAGE_COLLAPSE_TEXT_THRESHOLD = 360;
export const STICKY_USER_MESSAGE_COLLAPSED_MAX_HEIGHT = "min(20vh, 8rem)";

const getMessageTextLength = (message: SessionMessage) => {
  return message.parts.reduce((total, part) => {
    if (part.type !== "text") return total;
    return total + part.text.length;
  }, 0);
};

export const isStickyUserMessageCollapsible = (message: SessionMessage) => {
  if (message.role !== "user") return false;

  return getMessageTextLength(message) > STICKY_USER_MESSAGE_COLLAPSE_TEXT_THRESHOLD;
};
