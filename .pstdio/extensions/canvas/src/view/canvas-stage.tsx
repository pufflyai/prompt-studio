import { Box, Flex, Text } from "@chakra-ui/react";
import { useEffect, useLayoutEffect, useRef } from "react";
import type { CanvasDefinition } from "../canvases/definitions";
import { installGestures } from "../controller/gestures";
import type { CanvasRuntime } from "../controller/runtime";
import { ItemFrame } from "./item-frame";
import { CanvasToolbar } from "./toolbar";

interface StageProps {
  canvas: CanvasDefinition;
  runtime: CanvasRuntime;
}
export const CanvasStage = (props: StageProps) => {
  const { canvas, runtime } = props;
  const shell = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const container = shell.current!;
    runtime.mount(container, stage.current!);
    let measureFrame = 0;
    const measure = () => {
      cancelAnimationFrame(measureFrame);
      measureFrame = requestAnimationFrame(() => runtime.measure());
    };
    const observer = new ResizeObserver(measure);
    for (const element of runtime.elements()) observer.observe(element);
    observer.observe(container);
    runtime.measure();
    const cleanup = installGestures(container, runtime);
    return () => {
      cleanup();
      observer.disconnect();
      cancelAnimationFrame(measureFrame);
      runtime.dispose();
    };
  }, [runtime]);
  useEffect(() => {
    const navigate = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!link) return;
      event.preventDefault();
      const href = link.getAttribute("href");
      if (href?.startsWith("#canvas-item=")) runtime.reveal(decodeURIComponent(href.slice(13)));
    };
    document.addEventListener("click", navigate);
    document.addEventListener("auxclick", navigate);
    return () => {
      document.removeEventListener("click", navigate);
      document.removeEventListener("auxclick", navigate);
    };
  }, [runtime]);
  return (
    <Flex direction="column" h="full" minH="0" minW="0" bg="bg" color="fg">
      <CanvasToolbar runtime={runtime} />
      <Box
        ref={shell}
        role="region"
        aria-label={`${canvas.name} canvas`}
        aria-describedby="canvas-instructions"
        tabIndex={0}
        flex="1"
        minH="0"
        minW="0"
        position="relative"
        overflow="hidden"
        cursor="default"
        overscrollBehaviorX="none"
        _focusVisible={{ outline: "2px solid", outlineColor: "border.accent", outlineOffset: "-2px" }}
      >
        <Text id="canvas-instructions" srOnly>
          Drag empty space to pan. Use the move handle or its arrow keys to move a preview. Click a name to copy it.
          Focus the canvas for arrow keys, plus and minus, F to fit, and 0 to reset the camera.
        </Text>
        <Box data-canvas-empty position="absolute" inset="0" cursor="default" touchAction="none" />
        <Box ref={stage} position="absolute" top="0" left="0" transformOrigin="0 0" data-canvas-stage>
          {canvas.items.map((item) => (
            <ItemFrame key={item.id} item={item} runtime={runtime} />
          ))}
        </Box>
      </Box>
    </Flex>
  );
};
