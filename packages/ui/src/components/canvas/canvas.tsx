import { Box, useRecipe } from "@chakra-ui/react";
import { useImperativeHandle, useLayoutEffect, useRef } from "react";
import { canvasRecipe } from "../../theme/recipes/canvas";
import type { CanvasNavigation, CanvasProps } from "./canvas.types";
import { createCanvasInteractions } from "./canvas-interactions";

export const Canvas = (props: CanvasProps) => {
  const { ref, children, onPan, onZoom, onNavigationEnd, onFit, onReset, variant, ...rest } = props;
  const viewport = useRef<HTMLDivElement>(null);
  const callbacks = useRef<CanvasNavigation>({ onPan, onZoom, onNavigationEnd, onFit, onReset });
  const interactions = useRef<ReturnType<typeof createCanvasInteractions> | undefined>(undefined);
  const styles = useRecipe({ recipe: canvasRecipe })({ variant });
  useImperativeHandle(ref, () => viewport.current!, []);
  useLayoutEffect(() => {
    callbacks.current = { onPan, onZoom, onNavigationEnd, onFit, onReset };
  });
  useLayoutEffect(() => {
    const controller = createCanvasInteractions(viewport.current!, () => callbacks.current);
    interactions.current = controller;
    return () => {
      controller.dispose();
      interactions.current = undefined;
    };
  }, []);
  return (
    <Box
      ref={viewport}
      css={styles}
      role="region"
      aria-label="Canvas"
      tabIndex={0}
      {...rest}
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
  );
};
