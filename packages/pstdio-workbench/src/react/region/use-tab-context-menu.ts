import type { useScopedMenu } from "@pstdio/ui";
import { type MouseEvent, useRef, useState } from "react";

type TriggerProps = ReturnType<ReturnType<typeof useScopedMenu>["api"]["getContextTriggerProps"]>;

export const useTabContextMenu = (triggerId: string, disabled = false) => {
  const anchor = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const trigger = useRef<HTMLElement | null>(null);
  const handlers = useRef<TriggerProps | null>(null);
  const [state, setState] = useState<{
    opening?: { x: number; y: number };
    open: boolean;
  } | null>(null);
  const onContextMenu = (event: MouseEvent<HTMLElement>) => {
    if (disabled) {
      event.preventDefault();
      return;
    }
    event.stopPropagation();
    trigger.current = event.currentTarget;
    anchor.current = event.currentTarget.getBoundingClientRect();
    if (handlers.current) handlers.current.onContextMenu?.(event);
    else {
      event.preventDefault();
      setState({ opening: { x: event.clientX, y: event.clientY }, open: false });
    }
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
  return {
    menu: {
      triggerId,
      state,
      api: { open: state?.open ?? false },
      getAnchorRect: () => anchor.current,
      onTriggerPropsChange: (props: TriggerProps | null) => {
        handlers.current = props;
      },
      onOpeningSent: () => setState((current) => (current ? { open: current.open } : current)),
      onOpenChange: ({ open }: { open: boolean }) =>
        setState((current) => (current && current.open !== open ? { ...current, open } : current)),
      onEscapeKeyDown: () => {
        const element = trigger.current;
        if (element) requestAnimationFrame(() => element.focus({ preventScroll: true }));
      },
    },
    show,
    onContextMenu,
  };
};

export type TabContextMenu = ReturnType<typeof useTabContextMenu>["menu"];
