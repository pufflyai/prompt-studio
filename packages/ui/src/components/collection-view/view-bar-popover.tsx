import { Popover, Portal } from "@chakra-ui/react";
import { createContext, type ReactNode, type RefObject, useContext } from "react";

const ViewBarPopoverContext = createContext(false);

export interface ViewBarPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The button the menu opens from. Several buttons can open the same menu. */
  anchorRef: RefObject<HTMLElement | null>;
  width: string;
  placement?: "bottom-start" | "bottom-end";
  /** The quick picker draws its own panes edge to edge. */
  padding?: "0" | "2xs";
  testId?: string;
  children: ReactNode;
}

/** The menu shell for Search, Filter, and Sort. Menus inside it render in place, so using them never closes it. */
export const ViewBarPopover = (props: ViewBarPopoverProps) => {
  const { open, onOpenChange, anchorRef, width, placement = "bottom-start", padding = "2xs", testId, children } = props;
  const nested = useContext(ViewBarPopoverContext);

  return (
    <Popover.Root
      open={open}
      lazyMount
      unmountOnExit
      positioning={{
        placement,
        strategy: "fixed",
        hideWhenDetached: true,
        offset: { mainAxis: 8 },
        getAnchorElement: () => anchorRef.current,
      }}
      onOpenChange={(details) => onOpenChange(details.open)}
    >
      <Portal disabled={nested}>
        <Popover.Positioner>
          <Popover.Content
            data-testid={testId}
            width={width}
            maxWidth="calc(100vw - 32px)"
            padding={padding}
            gap="0"
            overflow="visible"
          >
            <ViewBarPopoverContext value>{children}</ViewBarPopoverContext>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
};
