import type { MouseEvent } from "react";

// Prevent the draggable row's native mouse default, while retaining normal button focus.
export const preventRowAccessoryDrag = (event: MouseEvent<HTMLElement>) => {
  if (event.button !== 0) return;
  event.preventDefault();
  if (event.target instanceof Element) event.target.closest<HTMLElement>("button, [role=button]")?.focus();
};
