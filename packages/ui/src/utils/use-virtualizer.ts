import {
  measureElement as measureRenderedElement,
  useVirtualizer as useTanStackVirtualizer,
} from "@tanstack/react-virtual";
import { useEffect, useState } from "react";

type VirtualizerOptions<TScrollElement extends Element, TItemElement extends Element> = Omit<
  Parameters<typeof useTanStackVirtualizer<TScrollElement, TItemElement>>[0],
  "useFlushSync"
>;

export const useVirtualizer = <TScrollElement extends Element, TItemElement extends Element>(
  options: VirtualizerOptions<TScrollElement, TItemElement>,
) => {
  // A scroll element owned by a parent gets its ref after this hook's layout effects run, so the
  // virtualizer finds it only on a later render. Render once after mount so rows do not wait for one.
  const [, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const measure = options.measureElement ?? measureRenderedElement;
  return useTanStackVirtualizer<TScrollElement, TItemElement>({
    ...options,
    // A row under a hidden ancestor, such as a retained workbench panel, has no layout and measures 0.
    // Keep its known size, or the list draws the wrong rows when it is shown again.
    measureElement: (element, entry, instance) => {
      if (element.getClientRects().length > 0) return measure(element, entry, instance);
      const index = instance.indexFromElement(element);
      return instance.itemSizeCache.get(instance.options.getItemKey(index)) ?? instance.options.estimateSize(index);
    },
    // Rows measure through ref callbacks during React commits. Let React batch their updates.
    useFlushSync: false,
  });
};
