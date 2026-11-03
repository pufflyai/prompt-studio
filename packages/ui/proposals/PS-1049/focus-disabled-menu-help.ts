import type { KeyboardEvent } from "react";

/** Keep explicitly focusable disabled-action help reachable before Tab leaves the menu. */
export const focusDisabledMenuHelp = (event: KeyboardEvent<HTMLDivElement>) => {
  if (event.key !== "Tab" || event.shiftKey) return;
  const menu = event.currentTarget;
  const help = [...menu.querySelectorAll<HTMLElement>('[data-part="item"][data-disabled] [tabindex="0"]')];
  const current = help.indexOf(menu.ownerDocument.activeElement as HTMLElement);
  const next = help[current + 1];
  if (!next) return;
  event.preventDefault();
  event.stopPropagation();
  next.focus();
};
