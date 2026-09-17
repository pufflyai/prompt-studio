type KeyDownLikeEvent = {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
};

export const shouldSubmitOnEnter = (event: KeyDownLikeEvent) => {
  if (event.key !== "Enter") return false;

  return !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey;
};

export const shouldRecallPrevious = (event: KeyDownLikeEvent) =>
  event.key === "ArrowUp" && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey;

export const shouldRecallNext = (event: KeyDownLikeEvent) =>
  event.key === "ArrowDown" && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey;
