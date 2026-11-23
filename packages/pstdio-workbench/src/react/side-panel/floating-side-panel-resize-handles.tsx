import { Box } from "@chakra-ui/react";
import { Maximize2 } from "lucide-react";
import type { FloatingPanelResizeDirection } from "./floating-side-panel-geometry";
import type { useFloatingSidePanel } from "./use-floating-side-panel";

const handles: { direction: FloatingPanelResizeDirection; label: string }[] = [
  { direction: "n", label: "top" },
  { direction: "s", label: "bottom" },
  { direction: "w", label: "left" },
  { direction: "e", label: "right" },
  { direction: "nw", label: "top left" },
  { direction: "ne", label: "top right" },
  { direction: "sw", label: "bottom left" },
  { direction: "se", label: "bottom right" },
];

export const FloatingSidePanelResizeHandles = (props: Pick<ReturnType<typeof useFloatingSidePanel>, "resizeProps">) => (
  <>
    {handles.map(({ direction, label }) => (
      <Box
        as="button"
        key={direction}
        aria-label={`Resize Side Panel from ${label}`}
        data-resize-direction={direction}
        layerStyle="floatingPanelResizeHandle"
        {...props.resizeProps(direction)}
      >
        {direction === "se" ? <Maximize2 size={12} pointerEvents="none" /> : null}
      </Box>
    ))}
  </>
);
