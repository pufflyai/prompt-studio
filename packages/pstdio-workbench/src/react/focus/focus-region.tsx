import { Box, type BoxProps } from "@chakra-ui/react";
import { type ReactNode, useEffect, useRef } from "react";
import type { WorkbenchCore, WorkbenchFocusRegionId } from "../../core";
import { useWorkbenchStore } from "../shared/use-workbench-store";

interface WorkbenchFocusRegionProps extends BoxProps {
  workbench: WorkbenchCore;
  region: WorkbenchFocusRegionId;
  children: ReactNode;
}

export const WorkbenchFocusRegion = (props: WorkbenchFocusRegionProps) => {
  const { workbench, region, children, ...boxProps } = props;
  const activeRegion = useWorkbenchStore(workbench.focus.store, (state) => state.activeRegion);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || activeRegion !== region) return;
    if (element.contains(document.activeElement)) return;
    element.focus({ preventScroll: true });
  }, [activeRegion, region]);

  return (
    <Box
      ref={ref}
      tabIndex={-1}
      outline="none"
      onFocusCapture={() => workbench.focus.setActiveRegion(region)}
      {...boxProps}
    >
      {children}
    </Box>
  );
};
