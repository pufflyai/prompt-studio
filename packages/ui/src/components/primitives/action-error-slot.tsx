import { Box } from "@chakra-ui/react";
import type { ReactNode } from "react";

interface ActionErrorSlotProps {
  children: ReactNode;
  edge?: "top" | "bottom" | "above" | "below";
}

/** Anchors feedback to a positioned owner without changing the owner's layout. */
export const ActionErrorSlot = (props: ActionErrorSlotProps) => {
  const { children, edge = "bottom" } = props;
  const top = edge === "below" ? "100%" : undefined;
  const bottom = edge === "above" ? "100%" : undefined;
  return (
    <Box
      position="absolute"
      top={edge === "top" ? "xs" : top}
      bottom={edge === "bottom" ? "xs" : bottom}
      insetInline={edge === "below" ? undefined : "xs"}
      insetInlineStart={edge === "below" ? "0" : undefined}
      minW={edge === "below" ? "2xs" : undefined}
      zIndex="docked"
      pointerEvents="none"
      display="grid"
      justifyItems="start"
      gap="2xs"
      css={{ "& > *": { pointerEvents: "auto" } }}
    >
      {children}
    </Box>
  );
};
