import { Box } from "@chakra-ui/react";
import type { WorkbenchCore, WorkbenchRegion } from "../../core";

interface WorkbenchHeaderBorderProps {
  workbench: WorkbenchCore;
  region: WorkbenchRegion;
}

// The header's bottom edge is painted as an absolutely-positioned line instead
// of a CSS border so an active outline tab can sit on top of it and merge with
// the panel content below. Hosting headers must set `position="relative"`; the
// tab strip uses a higher `zIndex` so the active tab paints over this line.
export const WorkbenchHeaderBorder = (props: WorkbenchHeaderBorderProps) => {
  const { workbench, region } = props;

  if (!workbench.layout.getRegionHeaderBorderBottom(region)) return null;

  return (
    <Box position="absolute" insetInline="0" bottom="0" h="1px" bg="border.subtle" pointerEvents="none" zIndex="0" />
  );
};
