import { Canvas } from "@pstdio/ui/canvas";
import { type ReactNode, type RefObject, useRef, useSyncExternalStore } from "react";
import type { CanvasRuntime } from "../controller/runtime";

export const CanvasViewport = (props: {
  runtime: CanvasRuntime;
  name: string;
  viewportRef: RefObject<HTMLDivElement | null>;
  children: ReactNode;
}) => {
  const { runtime, name, viewportRef, children } = props;
  const zoom = useSyncExternalStore(runtime.subscribe, () => runtime.get().camera.zoom);
  const wheel = useRef<number | undefined>(undefined);
  return (
    <Canvas
      ref={viewportRef}
      h="full"
      minH="0"
      minW="0"
      zoom={zoom}
      minZoom={0.000001}
      maxZoom={4}
      onPan={runtime.pan}
      onZoom={(change) => {
        const factor = change.factor === wheel.current ? change.factor ** 3 : change.factor;
        wheel.current = undefined;
        runtime.zoomChange({ ...change, factor });
      }}
      onWheelCapture={(event) => {
        const unit = [1, 16, event.currentTarget.clientHeight][event.deltaMode] ?? 1;
        wheel.current = event.ctrlKey || event.metaKey ? Math.exp((-event.deltaY * unit) / 1000) : undefined;
      }}
      onFit={runtime.fit}
      onReset={runtime.reset}
      onNavigationEnd={runtime.flush}
      onClick={(event) => {
        if (
          event.target instanceof Element &&
          event.currentTarget.contains(event.target) &&
          !event.target.closest("[data-canvas-item]")
        )
          runtime.select();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && event.target === event.currentTarget) runtime.select();
      }}
      data-canvas-viewport
      aria-label={`${name} canvas`}
      aria-describedby="canvas-instructions"
      tabIndex={0}
      position="relative"
      overflow="hidden"
      cursor="default"
      overscrollBehaviorX="none"
      _focusVisible={{ outline: "2px solid", outlineColor: "border.accent", outlineOffset: "-2px" }}
    >
      {children}
    </Canvas>
  );
};
