import { observeElementOffset, type Virtualizer } from "@tanstack/react-virtual";

/**
 * Report a scroll element's offset only while it has layout. A scroll queued before the element was
 * hidden is delivered with no layout and offset 0; using it would render and measure the first rows
 * while hidden and drop the reader's anchor when the element is shown again.
 */
export const observeLaidOutOffset = <TScrollElement extends Element, TItemElement extends Element>(
  instance: Virtualizer<TScrollElement, TItemElement>,
  onChange: (offset: number, isScrolling: boolean) => void,
) => {
  const element = instance.scrollElement;
  const hasLayout = () => element?.getClientRects().length !== 0;
  // TanStack reports the offset stored by an earlier scroll event, including its delayed scroll end.
  // Read the live offset so a value stored while hidden cannot return after the element is shown.
  const liveOffset = () => {
    if (!element) return 0;
    const { horizontal, isRtl } = instance.options;
    return horizontal ? element.scrollLeft * (isRtl ? -1 : 1) : element.scrollTop;
  };
  const stop = observeElementOffset(instance, (_offset, isScrolling) => {
    if (hasLayout()) onChange(liveOffset(), isScrolling);
  });
  if (!element) return stop;
  // Showing an element fires no scroll event, and restoring the same offset fires none either.
  // Resync the offset dropped while hidden and end the scroll that hiding interrupted.
  let visible = hasLayout();
  const layout = new ResizeObserver(() => {
    const shown = !visible && hasLayout();
    visible = hasLayout();
    if (shown) onChange(liveOffset(), false);
  });
  layout.observe(element);
  return () => {
    stop?.();
    layout.disconnect();
  };
};
