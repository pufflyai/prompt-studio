import { Box } from "@chakra-ui/react";
import { Maximize2 } from "lucide-react";
import type { useFloatingSidePanel } from "./use-floating-side-panel";

export const FloatingSidePanelResizeHandle = (props: Pick<ReturnType<typeof useFloatingSidePanel>, "resizeProps">) => (
  <Box
    as="button"
    aria-label="Resize Side Panel from top left"
    data-resize-direction="nw"
    layerStyle="floatingPanelResizeHandle"
    {...props.resizeProps}
  >
    <Maximize2 size={12} pointerEvents="none" />
  </Box>
);
