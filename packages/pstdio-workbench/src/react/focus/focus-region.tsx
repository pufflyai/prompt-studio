import { Box, type BoxProps } from "@chakra-ui/react";
import { type ReactNode, useEffect, useRef } from "react";
import type { WorkbenchCore, WorkbenchFocusArea } from "../../core";
import { useWorkbenchStore } from "../shared/use-workbench-store";

interface WorkbenchFocusRegionProps extends BoxProps {
  workbench: WorkbenchCore;
  area: WorkbenchFocusArea;
  children: ReactNode;
}

export const WorkbenchFocusRegion = (props: WorkbenchFocusRegionProps) => {
  const { workbench, area, children, ...boxProps } = props;
  const activeArea = useWorkbenchStore(workbench.focus.store, (state) => state.activeArea);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || activeArea !== area) return;
    if (element.contains(document.activeElement)) return;
    element.focus({ preventScroll: true });
  }, [activeArea, area]);

  return (
    <Box
      ref={ref}
      tabIndex={-1}
      outline="none"
      onFocusCapture={() => workbench.focus.setActiveArea(area)}
      {...boxProps}
    >
      {children}
    </Box>
  );
};
