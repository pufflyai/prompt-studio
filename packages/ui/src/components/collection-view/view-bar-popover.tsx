import { Popover, Portal } from "@chakra-ui/react";
import { type ReactNode, type RefObject, useEffect, useRef } from "react";

export interface ViewBarPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The button the menu opens from. Several buttons can open the same menu. */
  anchorRef: RefObject<HTMLElement | null>;
  width: string;
  /** The quick picker draws its own panes edge to edge. */
  padding?: "0" | "2xs";
  testId?: string;
  children: ReactNode;
}

/** The menu shell for Search, Filter, and Sort. Menus inside it render in place, so using them never closes it. */
export const ViewBarPopover = (props: ViewBarPopoverProps) => {
  const { open, onOpenChange, anchorRef, width, padding = "2xs", testId, children } = props;
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (contentRef.current?.contains(target) || anchorRef.current?.contains(target)) return;
      onOpenChange(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointerDown);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointerDown);
  }, [open, anchorRef, onOpenChange]);

  return (
    <Popover.Root
      open={open}
      lazyMount
      unmountOnExit
      closeOnInteractOutside={false}
      positioning={{
        placement: "bottom-start",
        offset: { mainAxis: 8 },
        getAnchorElement: () => anchorRef.current,
      }}
      onOpenChange={(details) => onOpenChange(details.open)}
    >
      <Portal>
        <Popover.Positioner>
          <Popover.Content
            ref={contentRef}
            data-testid={testId}
            width={width}
            maxWidth="calc(100vw - 32px)"
            padding={padding}
            gap="0"
            overflow="visible"
          >
            {children}
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
};
