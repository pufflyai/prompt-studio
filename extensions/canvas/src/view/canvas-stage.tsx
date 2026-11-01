import { Box, Flex, Text } from "@chakra-ui/react";
import { useLayoutEffect, useRef, useState } from "react";
import type { CanvasDefinition } from "../canvas-model";
import { installItemMovement } from "../controller/item-movement";
import type { CanvasRuntime } from "../controller/runtime";
import { FrameEditorMenu, FrameEditorOutlet } from "../parameters/editor-outlet";
import { CanvasViewport } from "./canvas-viewport";
import { ItemFrame } from "./item-frame";

interface StageProps {
  canvas: CanvasDefinition;
  runtime: CanvasRuntime;
}
export const CanvasStage = (props: StageProps) => {
  const { canvas, runtime } = props;
  const [outlet, setOutlet] = useState<HTMLDivElement | null>(null);
  const shell = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const container = shell.current!;
    // The camera owns navigation; native focus and scrollIntoView must not move its viewport.
    const overflow = container.style.overflow;
    container.style.overflow = "clip";
    runtime.mount(container, stage.current!);
    let active = true;
    let measureFrame = 0;
    const measure = () => {
      if (!active) return;
      cancelAnimationFrame(measureFrame);
      measureFrame = requestAnimationFrame(() => runtime.measure());
    };
    const observer = new ResizeObserver(measure);
    for (const element of runtime.elements()) observer.observe(element);
    observer.observe(container);
    runtime.measure();
    void document.fonts.ready.then(measure);
    document.fonts.addEventListener("loadingdone", measure);
    const cleanup = installItemMovement(container, runtime);
    return () => {
      active = false;
      cleanup();
      observer.disconnect();
      document.fonts.removeEventListener("loadingdone", measure);
      cancelAnimationFrame(measureFrame);
      container.style.overflow = overflow;
      runtime.dispose();
    };
  }, [runtime]);
  return (
    <FrameEditorOutlet value={outlet}>
      <Flex h="full" minH="0" minW="0">
        <Box flex="1" minW="0">
          <CanvasViewport viewportRef={shell} name={canvas.name} runtime={runtime}>
            <Text id="canvas-instructions" srOnly>
              Select a frame before interacting with its contents. Click empty space or press Escape on the canvas to
              clear selection. Drag empty space to pan. Use the move handle or its arrow keys to move a preview. Click a
              name to copy it. Focus the canvas for arrow keys, plus and minus, F to fit, and 0 to reset the camera.
            </Text>
            <Box ref={stage} position="absolute" top="0" left="0" transformOrigin="0 0" data-canvas-stage>
              {canvas.items.map((item) => (
                <ItemFrame key={item.id} item={item} runtime={runtime} />
              ))}
            </Box>
          </CanvasViewport>
        </Box>
        <FrameEditorMenu canvas={canvas} runtime={runtime} outlet={setOutlet} />
      </Flex>
    </FrameEditorOutlet>
  );
};
