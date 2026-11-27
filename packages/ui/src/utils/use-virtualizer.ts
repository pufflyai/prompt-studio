import {
  measureElement as measureRenderedElement,
  observeElementOffset,
  useVirtualizer as useTanStackVirtualizer,
} from "@tanstack/react-virtual";
import { useLayoutEffect, useState } from "react";

type VirtualizerOptions<TScrollElement extends Element, TItemElement extends Element> = Omit<
  Parameters<typeof useTanStackVirtualizer<TScrollElement, TItemElement>>[0],
  "useFlushSync"
>;

export const useVirtualizer = <TScrollElement extends Element, TItemElement extends Element>(
  options: VirtualizerOptions<TScrollElement, TItemElement>,
) => {
  // Callers pass a scroll element that a parent owns, and the parent gets its ref after this hook's
  // layout effects run. Render once more before paint so the first frame already has rows.
  const [, setMounted] = useState(false);
  useLayoutEffect(() => setMounted(true), []);
  const measure = options.measureElement ?? measureRenderedElement;
  const virtualizer = useTanStackVirtualizer<TScrollElement, TItemElement>({
    ...options,
    // A row under a hidden ancestor, such as a retained workbench panel, has no layout and measures 0.
    // Keep its known size, or the list draws the wrong rows when it is shown again. A row hidden on
    // purpose therefore keeps its height; no caller hides single rows.
    measureElement: (element, entry, instance) => {
      // ResizeObserver already measured visible rows. Reading their rects again during
      // split-panel motion forces another layout for every row on every animation frame.
      const observedSize = instance.options.horizontal ? entry?.contentRect.width : entry?.contentRect.height;
      if ((observedSize ?? 0) > 0 || element.getClientRects().length > 0) return measure(element, entry, instance);
      const index = instance.indexFromElement(element);
      return instance.itemSizeCache.get(instance.options.getItemKey(index)) ?? instance.options.estimateSize(index);
    },
    // A scroll queued before the scroll element was hidden is delivered with no layout and offset 0.
    // Keep the last visible offset, or the list renders and measures its first rows while hidden
    // and drops the reader's anchor when it is shown again.
    observeElementOffset: (instance, onChange) => {
      const element = instance.scrollElement;
      const hasLayout = () => element?.getClientRects().length !== 0;
      const stop = observeElementOffset(instance, (offset, isScrolling) => {
        if (hasLayout()) onChange(offset, isScrolling);
      });
      if (!element) return stop;
      // Showing an element fires no scroll event, and restoring the same offset fires none either.
      // Resync the offset dropped while hidden and end the scroll that hiding interrupted.
      let visible = hasLayout();
      const layout = new ResizeObserver(() => {
        const shown = !visible && hasLayout();
        visible = hasLayout();
        if (!shown) return;
        const { horizontal, isRtl } = instance.options;
        onChange(horizontal ? element.scrollLeft * (isRtl ? -1 : 1) : element.scrollTop, false);
      });
      layout.observe(element);
      return () => {
        stop?.();
        layout.disconnect();
      };
    },
    // Rows measure through ref callbacks during React commits. Let React batch their updates.
    useFlushSync: false,
  });
  // Render from current values. The instance stays the same when its measurements change,
  // so reading its methods in a compiled component can cache an old list height.
  return {
    virtualizer,
    virtualItems: virtualizer.getVirtualItems(),
    totalSize: virtualizer.getTotalSize(),
    measurements: virtualizer.measurementsCache,
  };
};
