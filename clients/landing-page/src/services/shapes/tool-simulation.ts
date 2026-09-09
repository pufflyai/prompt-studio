import Matter from "matter-js";
import {
  containerLayout,
  containerPiece,
  type FieldSize,
  MAX_TOOL_COUNT,
  randomToolPlacement,
  TOOL_SPAWN_INTERVAL,
} from "./field-layout";
import { createPiece, createWalls, type Piece } from "./shape-physics";

interface Point {
  x: number;
  y: number;
}

interface SimulationOptions {
  size: FieldSize;
  placements: ReturnType<typeof randomToolPlacement>[];
  windowOffset?: Point;
  onFrame: () => void;
}

export const createToolSimulation = (options: SimulationOptions) => {
  let size = options.size;
  let windowOffset = options.windowOffset;
  let appliedOffset = windowOffset;
  let velocity = { x: 0, y: 0 };
  let drag: Matter.Constraint | undefined;
  const engine = Matter.Engine.create({ gravity: { x: 0, y: 1.5, scale: 0.0011 } });
  const pieces = containerLayout(size, options.placements).pieces.map(createPiece);
  let walls = createWalls(size);
  Matter.Composite.add(engine.world, [...walls, ...pieces.map((piece) => piece.body)]);

  const spawnTimer = setInterval(() => {
    const piece = createPiece(containerPiece(size, pieces.length, randomToolPlacement()));
    pieces.push(piece);
    Matter.Composite.add(engine.world, piece.body);
    if (pieces.length >= MAX_TOOL_COUNT) clearInterval(spawnTimer);
  }, TOOL_SPAWN_INTERVAL);

  const runner = Matter.Runner.create();
  Matter.Runner.run(runner, engine);

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

  let frame = 0;
  const draw = () => {
    applyWindowMotion();
    options.onFrame();
    frame = requestAnimationFrame(draw);
  };
  frame = requestAnimationFrame(draw);

  const endDrag = () => {
    if (drag) Matter.Composite.remove(engine.world, drag);
    drag = undefined;
  };

  return {
    pieces,
    resize(nextSize: FieldSize) {
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
    },
    moveWindow(nextOffset?: Point) {
      windowOffset = nextOffset;
      if (!nextOffset) {
        appliedOffset = undefined;
        velocity = { x: 0, y: 0 };
      }
    },
    startDrag(piece: Piece, point: Point) {
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
      clearInterval(spawnTimer);
      cancelAnimationFrame(frame);
      Matter.Runner.stop(runner);
      Matter.Composite.clear(engine.world, false);
      Matter.Engine.clear(engine);
    },
  };
};
