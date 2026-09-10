import Matter from "matter-js";
import type { FieldPiece, FieldSize } from "./field-layout";
import { crossRectangles, halfDiscVertices } from "./tool-shape-geometry";

export type Piece = ReturnType<typeof createPiece>;

const createShapeBody = (item: FieldPiece, options: Matter.IChamferableBodyDefinition) => {
  const { kind, width, height } = item;
  const origin = { x: width / 2, y: height / 2 };
  if (kind === "automation") {
    return { body: Matter.Bodies.circle(origin.x, origin.y, height / 2, options), origin };
  }
  if (kind === "hook") {
    const parts = crossRectangles(width, height).map((rectangle) =>
      Matter.Bodies.rectangle(
        rectangle.x + rectangle.width / 2,
        rectangle.y + rectangle.height / 2,
        rectangle.width,
        rectangle.height,
        options,
      ),
    );
    return { body: Matter.Body.create({ ...options, parts }), origin };
  }
  if (kind === "skill") {
    const vertices = halfDiscVertices(width, height);
    const origin = Matter.Vertices.centre(vertices);
    return { body: Matter.Bodies.fromVertices(origin.x, origin.y, [vertices], options), origin };
  }
  return {
    body: Matter.Bodies.rectangle(origin.x, origin.y, width, height, {
      ...options,
      chamfer: { radius: Math.min(width, height) * 0.28 },
    }),
    origin,
  };
};

export const createPiece = (item: FieldPiece) => {
  const { body, origin } = createShapeBody(item, {
    restitution: 0.28,
    friction: 0.45,
    frictionStatic: 0.6,
    // Let the pile settle quickly after a throw.
    frictionAir: 0.035,
    density: 0.0018,
  });
  // The half-disc's centre of mass differs from the SVG box centre.
  const offset = Matter.Vector.rotate({ x: origin.x - item.width / 2, y: origin.y - item.height / 2 }, item.angle);
  Matter.Body.setAngle(body, item.angle);
  Matter.Body.setPosition(body, {
    x: item.x + item.width / 2 + offset.x,
    y: item.y + item.height / 2 + offset.y,
  });

  return { id: item.id, kind: item.kind, width: item.width, height: item.height, origin, body };
};

export const pieceTransform = (piece: Piece) =>
  `translate(${piece.body.position.x}px, ${piece.body.position.y}px) rotate(${piece.body.angle}rad) translate(${-piece.origin.x}px, ${-piece.origin.y}px)`;

export const createWalls = (size: FieldSize) => [
  Matter.Bodies.rectangle(size.width / 2, size.height + 30, size.width * 3, 60, { isStatic: true }),
  Matter.Bodies.rectangle(-30, size.height / 2, 60, size.height * 4, { isStatic: true }),
  Matter.Bodies.rectangle(size.width + 30, size.height / 2, 60, size.height * 4, { isStatic: true }),
];
