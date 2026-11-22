import type { KeyboardEvent } from "react";

export const keepNavigationFocus = (event: KeyboardEvent<HTMLDivElement>) => {
  if (event.key !== "Tab") return;
  const items = event.currentTarget.querySelectorAll<HTMLElement>("button:not([disabled]), [tabindex='0']");
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  }
  if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
};
