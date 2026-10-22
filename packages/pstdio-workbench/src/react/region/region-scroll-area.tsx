import { ScrollArea } from "@pstdio/ui";
import type { ReactNode } from "react";

// Let short views fill the viewport while tall views use the region scrollbar.
const verticalContentProps = { display: "flex", flexDirection: "column", minH: "100%", position: "relative" } as const;
const horizontalContentProps = {
  display: "flex",
  alignItems: "stretch",
  h: "full",
  minH: "100%",
  position: "relative",
} as const;

interface RegionScrollAreaProps {
  children: ReactNode;
  horizontal?: boolean;
  hidden?: boolean;
}

export const RegionScrollArea = (props: RegionScrollAreaProps) => {
  const { children, horizontal = false, hidden = false } = props;
  return (
    <ScrollArea
      display={hidden ? "none" : "flex"}
      flex="1"
      minH="0"
      minW="0"
      w="full"
      size="xs"
      showVerticalScrollbar={!horizontal}
      showHorizontalScrollbar={horizontal}
      viewportProps={horizontal ? { justifyContent: "center" } : undefined}
      contentProps={horizontal ? horizontalContentProps : verticalContentProps}
    >
      {children}
    </ScrollArea>
  );
};
