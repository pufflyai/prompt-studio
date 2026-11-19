import type { Menu, PortalProps } from "@chakra-ui/react";
import { createContext, useContext } from "react";

/** Nested popup portals belong inside the closest modal content. */
export const PortalContainerContext = createContext<PortalProps["container"]>(undefined);

/** Fixed popup positioning escapes a modal's clipped, scrolling content. */
export const usePortalPositioning = (positioning: Menu.RootProps["positioning"]) =>
  useContext(PortalContainerContext)
    ? { strategy: "fixed" as const, hideWhenDetached: true, ...positioning }
    : positioning;
