import { Box } from "@chakra-ui/react";
import Matter from "matter-js";
import { useEffect, useRef, useState } from "react";
import {
  containerLayout,
  containerPiece,
  type FieldPiece,
  INITIAL_TOOL_COUNT,
  MAX_TOOL_COUNT,
  type Perch,
  parcourLayout,
  randomToolPlacement,
  TOOL_SPAWN_INTERVAL,
} from "./field-layout";
import { createPiece, createWalls, type Piece } from "./shape-physics";
import { ToolShape } from "./tool-shapes";

const usePrefersReducedMotion = () => {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const onChange = () => setReduced(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return reduced;
};

interface ShapeFieldProps {
  spawn: "container" | "parcour";
  /** Measured text lines the parcour rests on. */
  perches?: Perch[];
  /** Position of the containing window. Moving it nudges the loose shapes. */
  worldOffset?: { x: number; y: number };
}

export const ShapeField = (props: ShapeFieldProps) => {
  const { spawn, perches, worldOffset } = props;
  const reducedMotion = usePrefersReducedMotion();

  const hostRef = useRef<HTMLDivElement>(null);
  const piecesRef = useRef<Piece[]>([]);
  const wallsRef = useRef<Matter.Body[]>([]);
  const engineRef = useRef<Matter.Engine | null>(null);
  const widthRef = useRef(0);
  const offsetRef = useRef(worldOffset);
  const appliedRef = useRef(worldOffset);
  const velocityRef = useRef({ x: 0, y: 0 });
  const dragRef = useRef<{ pointerId: number; constraint: Matter.Constraint } | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  // Keep each visit's random arrangement stable through redraws and panel resizing.
  const [initialPlacements] = useState(() => Array.from({ length: INITIAL_TOOL_COUNT }, randomToolPlacement));
  const [, forceRender] = useState(0);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const observer = new ResizeObserver(() => setSize({ width: host.clientWidth, height: host.clientHeight }));
    observer.observe(host);
    setSize({ width: host.clientWidth, height: host.clientHeight });

    return () => observer.disconnect();
  }, []);

  const layout = spawn === "container" ? containerLayout(size, initialPlacements) : parcourLayout(perches ?? []);
  const ready = size.width > 0 && size.height > 0 && layout.pieces.length > 0;

  // Declared first, so the world and boundary effects below read the current geometry.
  const layoutRef = useRef(layout);
  const sizeRef = useRef(size);
  useEffect(() => {
    layoutRef.current = layout;
    sizeRef.current = size;
  });

  useEffect(() => {
    if (!ready || reducedMotion) return;

    const engine = Matter.Engine.create({ gravity: { x: 0, y: 1.5, scale: 0.0011 } });
    engineRef.current = engine;

    const pieces = layoutRef.current.pieces.map(createPiece);
    piecesRef.current = pieces;
    wallsRef.current = createWalls(layoutRef.current.walls, sizeRef.current);
    widthRef.current = sizeRef.current.width;

    Matter.Composite.add(engine.world, [...wallsRef.current, ...pieces.map((piece) => piece.body)]);

    // New bodies join the existing world so the pile survives each arrival and resize.
    const spawnTimer =
      spawn === "container"
        ? setInterval(() => {
            const piece = createPiece(containerPiece(sizeRef.current, pieces.length, randomToolPlacement()));
            pieces.push(piece);
            Matter.Composite.add(engine.world, piece.body);
            if (pieces.length >= MAX_TOOL_COUNT) clearInterval(spawnTimer);
          }, TOOL_SPAWN_INTERVAL)
        : undefined;

    const runner = Matter.Runner.create();
    Matter.Runner.run(runner, engine);

    let frame = 0;
    const draw = () => {
      const current = offsetRef.current;
      const applied = appliedRef.current;
      if (current && applied) {
        // Inertia responds to the window's acceleration, not to how far it has moved: a
        // steady drag would otherwise keep pushing for its whole length and rearrange the
        // pile. This way the shapes lurch when the window starts and stops, and ride
        // along in between.
        // Capped first, so one huge jump cannot inject a huge impulse in a single frame.
        const dx = Math.max(-14, Math.min(14, current.x - applied.x));
        const dy = Math.max(-14, Math.min(14, current.y - applied.y));
        const last = velocityRef.current;
        velocityRef.current = { x: dx, y: dy };

        // Vertical is deliberately weaker: the shapes are supported from below, so a
        // downward move should make them lag briefly rather than launch up the panel.
        const ax = dx - last.x;
        const ay = dy - last.y;
        if (ax !== 0 || ay !== 0) {
          for (const piece of piecesRef.current) {
            Matter.Body.applyForce(piece.body, piece.body.position, {
              x: -ax * piece.body.mass * 0.0014,
              y: -ay * piece.body.mass * 0.00048,
            });
          }
        }
      }
      appliedRef.current = current;

      forceRender((value) => value + 1);
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);

    return () => {
      clearInterval(spawnTimer);
      cancelAnimationFrame(frame);
      Matter.Runner.stop(runner);
      Matter.Composite.clear(engine.world, false);
      Matter.Engine.clear(engine);
      engineRef.current = null;
      piecesRef.current = [];
      wallsRef.current = [];
    };
  }, [ready, reducedMotion, spawn]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;

    Matter.Composite.remove(engine.world, wallsRef.current);
    wallsRef.current = createWalls(spawn === "container" ? [] : parcourLayout(perches ?? []).walls, size);
    Matter.Composite.add(engine.world, wallsRef.current);

    // Keep the pile centred and inside the new boundaries when a panel shrinks.
    const shift = (size.width - widthRef.current) / 2;
    widthRef.current = size.width;
    if (shift !== 0) {
      for (const piece of piecesRef.current) Matter.Body.translate(piece.body, { x: shift, y: 0 });
    }
    for (const piece of piecesRef.current) {
      const halfWidth = piece.width / 2;
      const halfHeight = piece.height / 2;
      Matter.Body.setPosition(piece.body, {
        x: Math.max(halfWidth, Math.min(size.width - halfWidth, piece.body.position.x)),
        y: Math.min(size.height - halfHeight, piece.body.position.y),
      });
    }
  }, [size, perches, spawn]);

  useEffect(() => {
    offsetRef.current = worldOffset;
    if (!worldOffset) {
      appliedRef.current = undefined;
      velocityRef.current = { x: 0, y: 0 };
    }
  }, [worldOffset]);

  /** Clamped to the panel: a constraint can otherwise drag a body through the walls. */
  const localPoint = (event: { clientX: number; clientY: number }) => {
    const rect = hostRef.current?.getBoundingClientRect();
    const x = event.clientX - (rect?.left ?? 0);
    const y = event.clientY - (rect?.top ?? 0);

    return {
      x: Math.max(24, Math.min((rect?.width ?? 0) - 24, x)),
      y: Math.max(24, Math.min((rect?.height ?? 0) - 24, y)),
    };
  };

  const endDrag = () => {
    const engine = engineRef.current;
    const drag = dragRef.current;
    if (engine && drag) Matter.Composite.remove(engine.world, drag.constraint);
    dragRef.current = null;
  };

  const onPointerDown = (piece: Piece) => (event: React.PointerEvent<HTMLDivElement>) => {
    const engine = engineRef.current;
    if (!engine) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    endDrag();

    const point = localPoint(event);
    const constraint = Matter.Constraint.create({
      pointA: point,
      bodyB: piece.body,
      pointB: { x: point.x - piece.body.position.x, y: point.y - piece.body.position.y },
      // Soft on purpose: contacts with the walls and the rest of the pile have to be
      // able to win, so the body lags the pointer instead of teleporting.
      stiffness: 0.035,
      damping: 0.12,
      length: 0,
      render: { visible: false },
    });

    Matter.Composite.add(engine.world, constraint);
    dragRef.current = { pointerId: event.pointerId, constraint };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    drag.constraint.pointA = localPoint(event);
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    endDrag();
  };

  if (reducedMotion) {
    return (
      <Box ref={hostRef} position="absolute" inset="0" pointerEvents="none">
        {layout.pieces.map((piece: FieldPiece) => (
          <Box
            key={piece.id}
            data-tool-shape={piece.kind}
            position="absolute"
            left={`${piece.x}px`}
            top={`${piece.y}px`}
            transform={`rotate(${piece.angle}rad)`}
          >
            <ToolShape kind={piece.kind} size={piece.height} width={piece.width} />
          </Box>
        ))}
      </Box>
    );
  }

  return (
    <Box ref={hostRef} position="absolute" inset="0" pointerEvents="none" userSelect="none" touchAction="none">
      {piecesRef.current.map((piece) => (
        <Box
          key={piece.id}
          data-tool-shape={piece.kind}
          position="absolute"
          left="0"
          top="0"
          width={`${piece.width}px`}
          height={`${piece.height}px`}
          cursor="grab"
          pointerEvents="auto"
          _active={{ cursor: "grabbing" }}
          // Inline transform on purpose: this changes every frame, and a Chakra style
          // prop would mint a new atomic CSS class each time.
          style={{
            transform: `translate(${piece.body.position.x - piece.width / 2}px, ${
              piece.body.position.y - piece.height / 2
            }px) rotate(${piece.body.angle}rad)`,
          }}
          onPointerDown={onPointerDown(piece)}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <ToolShape kind={piece.kind} size={piece.height} width={piece.width} />
        </Box>
      ))}
    </Box>
  );
};
