import { type PointerEvent, useEffect, useRef, useState } from "react";
import type { Piece } from "../services/shapes/shape-physics";
import { readSimulation, saveSimulation } from "../services/shapes/simulation-state";
import { createToolSimulation } from "../services/shapes/tool-simulation";

export const useShapeField = (worldOffset?: { x: number; y: number }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<ReturnType<typeof createToolSimulation> | null>(null);
  const dragIdRef = useRef<number | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [, forceRender] = useState(0);
  const inputsRef = useRef({ size, worldOffset });

  useEffect(() => {
    inputsRef.current = { size, worldOffset };
  });

  useEffect(() => {
    const host = hostRef.current!;
    const updateSize = () => setSize({ width: host.clientWidth, height: host.clientHeight });
    const observer = new ResizeObserver(updateSize);
    observer.observe(host);
    updateSize();
    return () => {
      observer.disconnect();
    };
  }, []);

  const ready = size.width > 0 && size.height > 0;
  useEffect(() => {
    if (!ready) return;
    const { size, worldOffset } = inputsRef.current;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;
    const simulation = createToolSimulation({
      size,
      windowOffset: worldOffset,
      snapshot: readSimulation(),
      // Embedded preview toolbars can retain keyboard focus; see ADR 0029.
      isActive: () =>
        visible &&
        (window.top !== window || document.hasFocus()) &&
        document.visibilityState === "visible" &&
        !query.matches,
      onFrame: () => forceRender((value) => value + 1),
    });
    simulationRef.current = simulation;
    simulation.resize(size);
    forceRender((value) => value + 1);

    const endDrag = () => {
      simulation.endDrag();
      dragIdRef.current = null;
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    observer.observe(hostRef.current!);
    window.addEventListener("blur", endDrag);
    window.addEventListener("pagehide", endDrag);
    document.addEventListener("visibilitychange", endDrag);
    return () => {
      window.removeEventListener("blur", endDrag);
      window.removeEventListener("pagehide", endDrag);
      document.removeEventListener("visibilitychange", endDrag);
      observer.disconnect();
      saveSimulation(simulation.snapshot());
      simulation.dispose();
      simulationRef.current = null;
      dragIdRef.current = null;
    };
  }, [ready]);

  useEffect(() => simulationRef.current?.resize(size), [size]);
  useEffect(() => simulationRef.current?.moveWindow(worldOffset), [worldOffset]);

  const localPoint = (event: PointerEvent<HTMLDivElement>) => {
    const rect = hostRef.current!.getBoundingClientRect();
    return {
      x: Math.max(24, Math.min(rect.width - 24, event.clientX - rect.left)),
      y: Math.max(24, Math.min(rect.height - 24, event.clientY - rect.top)),
    };
  };

  const onPointerDown = (piece: Piece) => (event: PointerEvent<HTMLDivElement>) => {
    if (!simulationRef.current) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragIdRef.current = event.pointerId;
    simulationRef.current.startDrag(piece, localPoint(event));
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (dragIdRef.current === event.pointerId) simulationRef.current?.moveDrag(localPoint(event));
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (dragIdRef.current !== event.pointerId) return;
    simulationRef.current?.endDrag();
    dragIdRef.current = null;
  };

  return {
    hostRef,
    pieces: simulationRef.current?.pieces ?? [],
    onPointerDown,
    onPointerMove,
    onPointerUp,
  };
};
