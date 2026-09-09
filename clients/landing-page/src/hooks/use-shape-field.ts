import { type PointerEvent, useEffect, useRef, useState } from "react";
import { containerLayout, INITIAL_TOOL_COUNT, randomToolPlacement } from "../services/shapes/field-layout";
import type { Piece } from "../services/shapes/shape-physics";
import { createToolSimulation } from "../services/shapes/tool-simulation";

export const useShapeField = (worldOffset?: { x: number; y: number }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<ReturnType<typeof createToolSimulation> | null>(null);
  const dragIdRef = useRef<number | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [placements] = useState(() => Array.from({ length: INITIAL_TOOL_COUNT }, randomToolPlacement));
  const [, forceRender] = useState(0);
  const inputsRef = useRef({ size, worldOffset });

  useEffect(() => {
    inputsRef.current = { size, worldOffset };
  });

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setReducedMotion(query.matches);
    updateMotion();
    query.addEventListener("change", updateMotion);
    const host = hostRef.current!;
    const updateSize = () => setSize({ width: host.clientWidth, height: host.clientHeight });
    const observer = new ResizeObserver(updateSize);
    observer.observe(host);
    updateSize();
    return () => {
      query.removeEventListener("change", updateMotion);
      observer.disconnect();
    };
  }, []);

  const ready = size.width > 0 && size.height > 0;
  useEffect(() => {
    if (!ready || reducedMotion) return;
    const simulation = createToolSimulation({
      ...inputsRef.current,
      placements,
      onFrame: () => forceRender((value) => value + 1),
    });
    simulationRef.current = simulation;
    return () => {
      simulation.dispose();
      simulationRef.current = null;
      dragIdRef.current = null;
    };
  }, [ready, reducedMotion, placements]);

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
    reducedMotion,
    staticPieces: containerLayout(size, placements).pieces,
    pieces: simulationRef.current?.pieces ?? [],
    onPointerDown,
    onPointerMove,
    onPointerUp,
  };
};
