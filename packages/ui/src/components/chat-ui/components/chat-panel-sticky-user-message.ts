const SCROLL_BOUNDARY_EPSILON = 1;

interface StickyUserMessageScrollElement {
  clientHeight: number;
  scrollHeight: number;
  scrollTop: number;
}

export const shouldStopStickyUserMessageWheel = (element: StickyUserMessageScrollElement, deltaY: number) => {
  const maxScrollTop = Math.max(0, element.scrollHeight - element.clientHeight);

  if (deltaY === 0 || maxScrollTop <= SCROLL_BOUNDARY_EPSILON) return false;
  if (deltaY < 0) return element.scrollTop > SCROLL_BOUNDARY_EPSILON;

  return element.scrollTop < maxScrollTop - SCROLL_BOUNDARY_EPSILON;
};
