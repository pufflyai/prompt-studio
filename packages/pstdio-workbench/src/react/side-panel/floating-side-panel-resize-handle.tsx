import { Box } from "@chakra-ui/react";
import type { FloatingPanelResizeAnchor, FloatingPanelResizeCorner } from "./floating-side-panel-geometry";
import type { useFloatingSidePanel } from "./use-floating-side-panel";

interface FloatingSidePanelResizeHandleProps extends Pick<ReturnType<typeof useFloatingSidePanel>, "resizeProps"> {
  alignment: FloatingPanelResizeAnchor;
}

const corners: readonly FloatingPanelResizeCorner[] = ["nw", "ne"];
export const FloatingSidePanelResizeHandle = (props: FloatingSidePanelResizeHandleProps) => (
  <>
    {corners
      .filter(
        (corner) =>
          props.alignment === "center" || (corner === "nw" ? props.alignment === "right" : props.alignment === "left"),
      )
      .map((corner) => (
        <Box
          key={corner}
          as="button"
          aria-label={`Resize Side Panel from top ${corner === "nw" ? "left" : "right"}`}
          data-resize-direction={corner}
          layerStyle="floatingPanelResizeHandle"
          {...props.resizeProps(corner)}
        />
      ))}
  </>
);
