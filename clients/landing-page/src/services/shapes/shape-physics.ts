import Matter from "matter-js";
import type { AssemblyPiece } from "../../content/tool-assembly";
import type { AssemblyPosition } from "./assembly-drag";
import { type AssemblySlot, DEFAULT_FIELD_SIZE, type FieldSize } from "./assembly-layout";
import { trackDragMomentum } from "./drag-momentum";
import { crossRectangles, halfDiscVertices } from "./tool-shape-geometry";

const radians = (degrees: number) => (degrees * Math.PI) / 180;
const createShapeBody = (item: AssemblyPiece) => {
  const { kind, width, height } = item;
  const origin = { x: width / 2, y: height / 2 };
  const options = { restitution: 0.55, friction: 0.12, frictionStatic: 0.2, frictionAir: 0.018, density: 0.0018 };
  if (kind === "automation") return { body: Matter.Bodies.circle(origin.x, origin.y, height / 2, options), origin };
  if (kind === "hook") {
    const parts = crossRectangles(width, height).map((rect) =>
      Matter.Bodies.rectangle(rect.x + rect.width / 2, rect.y + rect.height / 2, rect.width, rect.height, options),
    );
    return { body: Matter.Body.create({ ...options, parts }), origin };
  }
  if (kind === "skill") {
    const vertices = halfDiscVertices(width, height);
    const center = Matter.Vertices.centre(vertices);
    return { body: Matter.Bodies.fromVertices(center.x, center.y, [vertices], options), origin: center };
  }
  return {
    body: Matter.Bodies.rectangle(origin.x, origin.y, width, height, {
      ...options,
      chamfer: { radius: Math.min(width, height) * 0.28 },
    }),
    origin,
  };
};
const createPiece = (definition: AssemblyPiece) => {
  const { body, origin } = createShapeBody(definition);
  const piece = { ...definition, body, origin, slot: undefined as AssemblySlot | undefined };
  setPosition(piece, definition.source);
  return piece;
};
export type PhysicsPiece = ReturnType<typeof createPiece>;
export interface PhysicsSnapshot {
  size: FieldSize;
  pieces: {
    id: string;
    position: AssemblyPosition;
    velocity: { x: number; y: number };
    angularVelocity: number;
    sleeping: boolean;
    slot?: string;
  }[];
}

const centerOffset = (piece: PhysicsPiece, angle: number) =>
  Matter.Vector.rotate(
    {
      x: piece.origin.x - piece.width / 2,
      y: piece.origin.y - piece.height / 2,
    },
    angle,
  );

export const physicsPosition = (piece: PhysicsPiece) => {
  const offset = centerOffset(piece, piece.body.angle);
  return {
    x: piece.body.position.x - offset.x,
    y: piece.body.position.y - offset.y,
    angle: (piece.body.angle * 180) / Math.PI,
  };
};
const setPosition = (piece: PhysicsPiece, point: AssemblyPosition) => {
  Matter.Body.setAngle(piece.body, radians(point.angle));
  const offset = centerOffset(piece, piece.body.angle);
  Matter.Body.setPosition(piece.body, { x: point.x + offset.x, y: point.y + offset.y });
};

const limitMomentum = (piece: PhysicsPiece, held: boolean) => {
  const speed = Matter.Body.getSpeed(piece.body);
  if (!held && speed > 18) Matter.Body.setVelocity(piece.body, Matter.Vector.mult(piece.body.velocity, 18 / speed));
  // Fast contact impulses can turn linear movement into runaway spinning.
  const radius = Math.hypot(piece.width, piece.height) / 2;
  const edgeSpeed = Math.abs(piece.body.angularVelocity) * radius;
  if (edgeSpeed > 18) Matter.Body.setAngularVelocity(piece.body, piece.body.angularVelocity * (18 / edgeSpeed));
};

/** Human and agent drags steer bodies through the same collision world. */
export const createShapePhysics = (definitions: AssemblyPiece[], initialSize: FieldSize = DEFAULT_FIELD_SIZE) => {
  let size = initialSize;
  const engine = Matter.Engine.create({ gravity: { x: 0, y: 1.2 }, enableSleeping: true });
  const pieces = definitions.map(createPiece);
  const grips = new Map<
    string,
    { piece: PhysicsPiece; target: { x: number; y: number }; momentum: ReturnType<typeof trackDragMomentum> }
  >();
  const createWalls = () => [
    Matter.Bodies.rectangle(size.width / 2, -30, size.width + 120, 60, { isStatic: true }),
    Matter.Bodies.rectangle(size.width / 2, size.height + 30, size.width + 120, 60, { isStatic: true }),
    Matter.Bodies.rectangle(-30, size.height / 2, 60, size.height + 120, { isStatic: true }),
    Matter.Bodies.rectangle(size.width + 30, size.height / 2, 60, size.height + 120, { isStatic: true }),
  ];
  let walls = createWalls();
  Matter.Composite.add(engine.world, [...walls, ...pieces.map((piece) => piece.body)]);
  const release = (piece: PhysicsPiece) => {
    const grip = grips.get(piece.id);
    if (grip) Matter.Body.setVelocity(piece.body, grip.momentum.velocity());
    grips.delete(piece.id);
  };
  const grab = (piece: PhysicsPiece) => {
    release(piece);
    piece.slot = undefined;
    Matter.Body.setStatic(piece.body, false);
    Matter.Sleeping.set(piece.body, false);
    const point = physicsPosition(piece);
    grips.set(piece.id, {
      piece,
      target: { x: point.x, y: point.y },
      momentum: trackDragMomentum(piece.body.position),
    });
  };
  const snap = (piece: PhysicsPiece, slot: AssemblySlot) => {
    release(piece);
    piece.slot = slot;
    setPosition(piece, { x: slot.x, y: slot.y, angle: 0 });
    Matter.Body.setStatic(piece.body, true);
  };
  let accumulator = 0;
  const advance = (delta: number, remainingUpdates: number) => {
    // Sleeping neighbours act like fixed obstacles until a pull is fast enough to wake them.
    // Keep the small shared pile awake during drags so slow pulls move it from the first step.
    if (grips.size)
      pieces.forEach(({ body }) => {
        Matter.Sleeping.set(body, false);
      });
    // Spread the pointer movement over the fixed updates in this frame.
    const moving = [...grips.values()].map(({ piece, target }) => {
      const point = physicsPosition(piece);
      const offset = Matter.Vector.mult(Matter.Vector.sub(target, point), 1 / remainingUpdates);
      return { piece, target: Matter.Vector.add(point, offset), distance: Matter.Vector.magnitude(offset) };
    });
    // Small actual body movements let Matter resolve contacts before the next movement.
    const travel = Math.max(0, ...moving.map(({ distance }) => distance));
    const steps = Math.max(1, Math.ceil(travel / 8));
    for (let step = 0; step < steps; step++) {
      for (const { piece, target } of moving) {
        const offset = Matter.Vector.sub(target, physicsPosition(piece));
        const distance = Matter.Vector.magnitude(offset);
        const fraction = Math.min(1 / (steps - step), 8 / (distance || 1));
        const velocity = Matter.Vector.mult(offset, (fraction * (1000 / 60)) / (delta / steps));
        Matter.Body.setVelocity(piece.body, velocity);
      }
      for (const piece of pieces) limitMomentum(piece, grips.has(piece.id));
      Matter.Engine.update(engine, delta / steps);
    }
    for (const { piece, momentum } of grips.values()) momentum.sample(piece.body.position, delta);
  };
  return {
    pieces,
    grab,
    release,
    snap,
    snapshot: () => ({
      size: { ...size },
      pieces: pieces.map((piece) => ({
        id: piece.id,
        position: physicsPosition(piece),
        velocity: { ...Matter.Body.getVelocity(piece.body) },
        angularVelocity: Matter.Body.getAngularVelocity(piece.body),
        sleeping: piece.body.isSleeping,
        slot: piece.slot?.id,
      })),
    }),
    restore: (snapshot: PhysicsSnapshot, slots: AssemblySlot[]) => {
      for (const saved of snapshot.pieces) {
        const piece = pieces.find((piece) => piece.id === saved.id)!;
        const slot = slots.find((slot) => slot.id === saved.slot);
        if (slot) snap(piece, slot);
        else {
          setPosition(piece, saved.position);
          Matter.Body.setVelocity(piece.body, saved.velocity);
          Matter.Body.setAngularVelocity(piece.body, saved.angularVelocity);
          Matter.Sleeping.set(piece.body, saved.sleeping);
        }
      }
    },
    resize: (nextSize: FieldSize) => {
      const previous = size;
      size = nextSize;
      const resized = size.width !== previous.width || size.height !== previous.height;
      if (resized) {
        Matter.Composite.remove(engine.world, walls);
        walls = createWalls();
        Matter.Composite.add(engine.world, walls);
      }
      for (const piece of pieces) {
        if (piece.slot) {
          snap(piece, piece.slot);
          continue;
        }
        if (!resized) continue;
        const point = physicsPosition(piece);
        const fit = (position: { x: number; y: number }) => ({
          x: Math.max(
            piece.width / 2,
            Math.min(size.width - piece.width / 2, (position.x / previous.width) * size.width),
          ),
          y: Math.max(
            piece.height / 2,
            Math.min(size.height - piece.height / 2, (position.y / previous.height) * size.height),
          ),
        });
        setPosition(piece, { ...point, ...fit(point) });
        const grip = grips.get(piece.id);
        if (grip) {
          grip.target = fit(grip.target);
          grip.momentum.reset(piece.body.position);
        }
      }
    },
    move: (piece: PhysicsPiece, point: AssemblyPosition) => {
      const grip = grips.get(piece.id);
      if (!grip) return;
      const target = {
        x: Math.max(piece.width / 2, Math.min(size.width - piece.width / 2, point.x)),
        y: Math.max(piece.height / 2, Math.min(size.height - piece.height / 2, point.y)),
      };
      // A reversed gesture starts a new throw; idle physics ticks must retain the old one.
      if (Matter.Vector.dot(Matter.Vector.sub(target, grip.target), grip.momentum.velocity()) < 0)
        grip.momentum.reset(piece.body.position);
      grip.target = target;
    },
    nudge: (piece: PhysicsPiece, point: AssemblyPosition) => {
      setPosition(piece, point);
      grips.get(piece.id)?.momentum.reset(piece.body.position);
      Matter.Body.setVelocity(piece.body, { x: 0, y: 0 });
      Matter.Body.setAngularVelocity(piece.body, 0);
    },
    step: (delta: number) => {
      accumulator += Math.min(delta, 48);
      let updates = Math.floor(accumulator / (1000 / 120));
      while (updates > 0) {
        advance(1000 / 120, updates);
        accumulator -= 1000 / 120;
        updates -= 1;
      }
    },
    dispose: () => {
      Matter.Composite.clear(engine.world, false);
      Matter.Engine.clear(engine);
      grips.clear();
    },
  };
};
