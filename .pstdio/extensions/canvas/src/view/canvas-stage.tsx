import { Box, Text } from "@chakra-ui/react";
import { Canvas } from "@pstdio/ui/canvas";
import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from "react";
import type { CanvasDefinition } from "../canvases/definitions";
import { installItemMovement } from "../controller/item-movement";
import type { CanvasRuntime } from "../controller/runtime";
import { ItemFrame } from "./item-frame";

interface StageProps {
  canvas: CanvasDefinition;
  runtime: CanvasRuntime;
}
export const CanvasStage = (props: StageProps) => {
  const { canvas, runtime } = props;
  const shell = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const zoom = useSyncExternalStore(runtime.subscribe, () => runtime.get().camera.zoom);
  useLayoutEffect(() => {
    const container = shell.current!;
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
    <Canvas
      ref={shell}
      h="full"
      zoom={zoom}
      minZoom={0.000001}
      maxZoom={4}
      onPan={runtime.pan}
      onZoom={runtime.zoomChange}
      onFit={runtime.fit}
      onReset={runtime.reset}
      onNavigationEnd={runtime.flush}
      aria-label={`${canvas.name} canvas`}
      aria-describedby="canvas-instructions"
      tabIndex={0}
      minH="0"
      minW="0"
      position="relative"
      overflow="hidden"
      cursor="default"
      overscrollBehaviorX="none"
      _focusVisible={{ outline: "2px solid", outlineColor: "border.accent", outlineOffset: "-2px" }}
    >
      <Text id="canvas-instructions" srOnly>
        Drag empty space to pan. Use the move handle or its arrow keys to move a preview. Click a name to copy it. Focus
        the canvas for arrow keys, plus and minus, F to fit, and 0 to reset the camera.
      </Text>
      <Box ref={stage} position="absolute" top="0" left="0" transformOrigin="0 0" data-canvas-stage>
        {canvas.items.map((item) => (
          <ItemFrame key={item.id} item={item} runtime={runtime} />
        ))}
      </Box>
    </Canvas>
  );
};
