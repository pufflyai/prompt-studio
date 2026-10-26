import { Box, useRecipe } from "@chakra-ui/react";
import { useImperativeHandle, useLayoutEffect, useRef } from "react";
import { canvasFrameRecipe, canvasRecipe } from "../../theme/recipes/canvas";
import type { CanvasProps } from "./canvas.types";
import { defaultCanvasZoomLimits } from "./canvas-geometry";
import { createCanvasInteractions } from "./canvas-interactions";
import { CanvasZoomControls } from "./canvas-zoom-controls";
import { useCanvasNavigation } from "./use-canvas-navigation";

export const Canvas = (props: CanvasProps) => {
  const {
    ref,
    children,
    onPan,
    onZoom,
    onNavigationEnd,
    onFit,
    onReset,
    variant,
    zoom,
    minZoom = defaultCanvasZoomLimits.minZoom,
    maxZoom = defaultCanvasZoomLimits.maxZoom,
    "aria-label": label = "Canvas",
    ...rest
  } = props;
  const viewport = useRef<HTMLDivElement>(null);
  const { navigation, zoomTo, zoomBy, resetZoom } = useCanvasNavigation(props, viewport);
  const viewportProps: Record<string, unknown> = {};
  const frameProps: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rest)) {
    const belongsToViewport =
      key.startsWith("on") ||
      key.startsWith("aria-") ||
      key.startsWith("data-") ||
      ["id", "role", "tabIndex", "title"].includes(key);
    if (belongsToViewport) viewportProps[key] = value;
    else frameProps[key] = value;
  }
  const interactions = useRef<ReturnType<typeof createCanvasInteractions> | undefined>(undefined);
  const styles = useRecipe({ recipe: canvasRecipe })({ variant });
  const frameStyles = useRecipe({ recipe: canvasFrameRecipe })();
  useImperativeHandle(ref, () => viewport.current!, []);
  useLayoutEffect(() => {
    const controller = createCanvasInteractions(viewport.current!, () => navigation.current);
    interactions.current = controller;
    return () => {
      controller.dispose();
      interactions.current = undefined;
    };
  }, [navigation]);
  return (
    <Box css={frameStyles} {...frameProps} data-canvas-frame>
      <Box
        ref={viewport}
        css={styles}
        role="region"
        aria-label={label}
        tabIndex={0}
        {...viewportProps}
        data-canvas-viewport
        onPointerDownCapture={(event) => interactions.current?.pointerDown(event)}
        onPointerMoveCapture={(event) => interactions.current?.pointerMove(event)}
        onPointerUpCapture={(event) => interactions.current?.pointerEnd(event)}
        onPointerCancelCapture={(event) => interactions.current?.pointerEnd(event)}
        onLostPointerCapture={(event) => interactions.current?.pointerLost(event)}
        onClickCapture={(event) => interactions.current?.click(event)}
        onAuxClickCapture={(event) => interactions.current?.click(event)}
      >
        <Box position="absolute" inset="0" zIndex="-1" touchAction="none" data-canvas-background />
        {children}
      </Box>
      <CanvasZoomControls
        zoom={zoom}
        minZoom={minZoom}
        maxZoom={maxZoom}
        resetZoom={resetZoom}
        onChange={zoomTo}
        onStep={zoomBy}
      />
    </Box>
  );
};
