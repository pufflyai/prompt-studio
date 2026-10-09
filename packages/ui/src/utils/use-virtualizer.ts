import { useVirtualizer as useTanStackVirtualizer } from "@tanstack/react-virtual";

export const useVirtualizer = <TScrollElement extends Element, TItemElement extends Element>(
  options: Omit<Parameters<typeof useTanStackVirtualizer<TScrollElement, TItemElement>>[0], "useFlushSync">,
) =>
  // Rows measure through ref callbacks during React commits. Let React batch their updates.
  useTanStackVirtualizer<TScrollElement, TItemElement>({ ...options, useFlushSync: false });
