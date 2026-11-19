import { Tooltip } from "@chakra-ui/react";
import { createContext } from "react";
import { useScopedOpen } from "./use-scoped-open";

export const TooltipPresence = createContext(false);
const TooltipRoot = (props: Tooltip.RootProps) => (
  <TooltipPresence value={true}>
    <Tooltip.Root {...useScopedOpen(props)} />
  </TooltipPresence>
);
export const ScopedTooltip: typeof Tooltip = { ...Tooltip, Root: TooltipRoot };
