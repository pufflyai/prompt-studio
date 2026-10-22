import { useMenu } from "@chakra-ui/react";
import { type MouseEvent, useRef } from "react";

export const useTabContextMenu = (triggerId: string, disabled = false) => {
  const anchor = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const trigger = useRef<HTMLElement | null>(null);
  const menu = useMenu({
    ids: { trigger: triggerId },
    positioning: { placement: "bottom-start", getAnchorRect: () => anchor.current, offset: { mainAxis: 0 } },
    onEscapeKeyDown: () => {
      const element = trigger.current;
      if (element) requestAnimationFrame(() => element.focus({ preventScroll: true }));
    },
  });
  const onContextMenu = (event: MouseEvent<HTMLElement>) => {
    if (disabled) {
      event.preventDefault();
      return;
    }
    event.stopPropagation();
    trigger.current = event.currentTarget;
    anchor.current = event.currentTarget.getBoundingClientRect();
    // Context-menu dismissal preserves outside focus; Escape restores it explicitly.
    menu.api.getContextTriggerProps().onContextMenu?.(event);
  };
  const show = (element: HTMLElement) => {
    if (disabled) return;
    const rect = element.getBoundingClientRect();
    element.dispatchEvent(
      new window.MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        clientX: rect.left,
        clientY: rect.bottom,
      }),
    );
  };
  return { menu, show, onContextMenu };
};
