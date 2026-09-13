import Matter from "matter-js";
import {
  containerLayout,
  containerPiece,
  type FieldSize,
  INITIAL_TOOL_COUNT,
  MAX_TOOL_COUNT,
  randomToolPlacement,
  TOOL_SPAWN_INTERVAL,
} from "./field-layout";
import { createPiece, createWalls, type Piece } from "./shape-physics";
import { restorePiece, type SimulationSnapshot, snapshotPiece } from "./simulation-state";

interface Point {
  x: number;
  y: number;
}

interface SimulationOptions {
  size: FieldSize;
  snapshot: SimulationSnapshot | null;
  windowOffset?: Point;
  isActive: () => boolean;
  onFrame: () => void;
}

export const createToolSimulation = (options: SimulationOptions) => {
  let size = options.snapshot?.size ?? options.size;
  let windowOffset = options.windowOffset;
  let appliedOffset = windowOffset;
  let velocity = { x: 0, y: 0 };
  let drag: Matter.Constraint | undefined;
  const engine = Matter.Engine.create({ gravity: { x: 0, y: 1.5, scale: 0.0011 } });
  const pieces = options.snapshot
    ? options.snapshot.pieces.map(restorePiece)
    : containerLayout(size, Array.from({ length: INITIAL_TOOL_COUNT }, randomToolPlacement)).pieces.map(createPiece);
  let walls = createWalls(size);
  Matter.Composite.add(engine.world, [...walls, ...pieces.map((piece) => piece.body)]);

  const runner = Matter.Runner.create();
  let active = false;
  let spawnRemaining = options.snapshot?.spawnRemaining ?? TOOL_SPAWN_INTERVAL;

  const applyWindowMotion = () => {
    if (windowOffset && appliedOffset) {
      const dx = Math.max(-14, Math.min(14, windowOffset.x - appliedOffset.x));
      const dy = Math.max(-14, Math.min(14, windowOffset.y - appliedOffset.y));
      const ax = dx - velocity.x;
      const ay = dy - velocity.y;
      velocity = { x: dx, y: dy };
      // Acceleration nudges the pile when the window starts and stops moving.
      if (ax !== 0 || ay !== 0) {
        for (const piece of pieces) {
          Matter.Body.applyForce(piece.body, piece.body.position, {
            x: -ax * piece.body.mass * 0.0014,
            y: -ay * piece.body.mass * 0.00048,
          });
        }
      }
    }
    appliedOffset = windowOffset;
  };

  Matter.Events.on(engine, "beforeUpdate", applyWindowMotion);
  Matter.Events.on(engine, "afterUpdate", () => {
    if (pieces.length >= MAX_TOOL_COUNT) return;
    spawnRemaining -= engine.timing.lastDelta;
    if (spawnRemaining > 0) return;
    const piece = createPiece(containerPiece(size, pieces.length, randomToolPlacement()));
    pieces.push(piece);
    Matter.Composite.add(engine.world, piece.body);
    spawnRemaining += TOOL_SPAWN_INTERVAL;
  });
  Matter.Events.on(runner, "afterTick", options.onFrame);

  const endDrag = () => {
    if (drag) Matter.Composite.remove(engine.world, drag);
    drag = undefined;
  };

  let frame = 0;
  const update = (time: number) => {
    const nextActive = options.isActive();
    if (active !== nextActive) {
      active = nextActive;
      appliedOffset = windowOffset;
      velocity = { x: 0, y: 0 };
      if (!active) endDrag();
    }
    if (active) Matter.Runner.tick(runner, engine, time);
    frame = requestAnimationFrame(update);
  };
  frame = requestAnimationFrame(update);

  return {
    pieces,
    snapshot: () => ({ size, spawnRemaining, pieces: pieces.map(snapshotPiece) }),
    resize(nextSize: FieldSize) {
      if (size.width === nextSize.width && size.height === nextSize.height) return;
      Matter.Composite.remove(engine.world, walls);
      walls = createWalls(nextSize);
      Matter.Composite.add(engine.world, walls);
      const shift = (nextSize.width - size.width) / 2;
      size = nextSize;
      for (const piece of pieces) {
        if (shift !== 0) Matter.Body.translate(piece.body, { x: shift, y: 0 });
        const { min, max } = piece.body.bounds;
        Matter.Body.translate(piece.body, {
          x: Math.max(0, -min.x) + Math.min(0, size.width - max.x),
          y: Math.min(0, size.height - max.y),
        });
      }
      options.onFrame();
    },
    moveWindow(nextOffset?: Point) {
      windowOffset = nextOffset;
      if (!nextOffset) {
        appliedOffset = undefined;
        velocity = { x: 0, y: 0 };
      }
    },
    startDrag(piece: Piece, point: Point) {
      if (!active) return;
      endDrag();
      drag = Matter.Constraint.create({
        pointA: point,
        bodyB: piece.body,
        pointB: { x: point.x - piece.body.position.x, y: point.y - piece.body.position.y },
        // A soft constraint lets collisions keep the dragged body inside the panel.
        stiffness: 0.035,
        damping: 0.12,
        length: 0,
        render: { visible: false },
      });
      Matter.Composite.add(engine.world, drag);
    },
    moveDrag(point: Point) {
      if (drag) drag.pointA = point;
    },
    endDrag,
    dispose() {
      cancelAnimationFrame(frame);
      Matter.Composite.clear(engine.world, false);
      Matter.Engine.clear(engine);
    },
  };
};
