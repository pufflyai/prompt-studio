import { Box } from "@chakra-ui/react";
import type { WorkbenchArea, WorkbenchCore } from "../../core";

interface WorkbenchHeaderBorderProps {
  workbench: WorkbenchCore;
  area: WorkbenchArea;
}

// The header's bottom edge is painted as an absolutely-positioned line instead
// of a CSS border so an active outline tab can sit on top of it and merge with
// the panel content below. Hosting headers must set `position="relative"`; the
// tab strip uses a higher `zIndex` so the active tab paints over this line.
export const WorkbenchHeaderBorder = (props: WorkbenchHeaderBorderProps) => {
  const { workbench, area } = props;

  if (!workbench.layout.getAreaHeaderBorderBottom(area)) return null;

  return (
    <Box position="absolute" insetInline="0" bottom="0" h="1px" bg="border.muted" pointerEvents="none" zIndex="0" />
  );
};
